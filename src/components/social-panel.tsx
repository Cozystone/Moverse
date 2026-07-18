'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  Ban,
  CalendarCheck2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  Flag,
  LockKeyhole,
  MapPin,
  MoreHorizontal,
  Search,
  Send,
  Share2,
  Shield,
  ShieldCheck,
  UserRoundCheck,
  Users,
  X,
} from 'lucide-react'

export type MateAvailability = {
  date: string
  label: string
  time: string
}

export type SocialMate = {
  id: string
  nickname: string
  avatar?: string
  level?: number
  sports?: string[]
  lastActivity?: string
  lastMessage?: string
  lastMessageAt?: string
  sharedActivities?: number
  status?: 'online' | 'away' | 'offline'
  isMutual?: boolean
  metThroughActivity?: boolean
  activityBadge?: string
  availability?: MateAvailability[]
}

export type MoveAgainSchedule = {
  mateId: string
  mateNickname: string
  activity: string
  date: string
  dateLabel: string
  time: string
  spot: string
}

export type SocialPanelProps = {
  open: boolean
  onClose: () => void
  onBump?: () => void
  mates?: SocialMate[]
  onScheduleCreated?: (schedule: MoveAgainSchedule) => void
  currentUserName?: string
}

type SharedMoveCard = {
  kind: 'event' | 'spot'
  title: string
  meta: string
  detail: string
}

type ChatMessage = {
  id: string
  sender: 'me' | 'mate' | 'system'
  sentAt: string
  text?: string
  card?: SharedMoveCard
  schedule?: MoveAgainSchedule
}

type PanelView = 'mates' | 'chat' | 'schedule'
type SafetyModal = 'menu' | 'block' | 'report' | null

const DEMO_MATES: SocialMate[] = [
  {
    id: 'lumi',
    nickname: 'LUMI',
    level: 8,
    sports: ['조깅', '배드민턴'],
    lastActivity: '중앙공원 20분 워크',
    lastMessage: '다음에는 리버사이드로 달려볼래?',
    lastMessageAt: '18:42',
    sharedActivities: 3,
    status: 'online',
    isMutual: true,
    metThroughActivity: true,
    activityBadge: '시간 약속을 잘 지켜요',
    availability: [
      { date: '2026-07-20', label: '7월 20일 · 월', time: '17:00–17:40' },
      { date: '2026-07-21', label: '7월 21일 · 화', time: '18:00–18:40' },
      { date: '2026-07-22', label: '7월 22일 · 수', time: '16:30–17:10' },
    ],
  },
  {
    id: 'dash',
    nickname: 'DASH',
    level: 11,
    sports: ['농구', '축구'],
    lastActivity: '시민코트 농구 3×3',
    lastMessage: '오늘 패스 좋았어! 다음 경기에서 보자.',
    lastMessageAt: '어제',
    sharedActivities: 2,
    status: 'away',
    isMutual: true,
    metThroughActivity: true,
    activityBadge: '초보자 친화 메이트',
    availability: [
      { date: '2026-07-20', label: '7월 20일 · 월', time: '18:00–18:40' },
      { date: '2026-07-22', label: '7월 22일 · 수', time: '17:30–18:10' },
    ],
  },
  {
    id: 'mint',
    nickname: 'MINT',
    level: 6,
    sports: ['걷기', '플로깅'],
    lastActivity: '주말 플로깅 레이드',
    lastMessage: '새 스팟 검증도 같이 가자!',
    lastMessageAt: '금',
    sharedActivities: 1,
    status: 'offline',
    isMutual: true,
    metThroughActivity: true,
    activityBadge: '공식 스팟 활동 완료',
    availability: [
      { date: '2026-07-21', label: '7월 21일 · 화', time: '17:00–17:40' },
      { date: '2026-07-22', label: '7월 22일 · 수', time: '16:30–17:10' },
    ],
  },
]

const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {
  lumi: [
    {
      id: 'lumi-system',
      sender: 'system',
      sentAt: '18:31',
      text: '중앙공원 20분 걷기를 함께 완료했어요. 서로 수락해 메이트가 되었어요.',
    },
    {
      id: 'lumi-1',
      sender: 'mate',
      sentAt: '18:39',
      text: '오늘 같이 걸어서 재밌었어! 다음에는 조금 달려봐도 좋겠다.',
    },
    {
      id: 'lumi-2',
      sender: 'me',
      sentAt: '18:41',
      text: '좋아. 우리 둘 다 가능한 시간 찾아보자!',
    },
    {
      id: 'lumi-3',
      sender: 'mate',
      sentAt: '18:42',
      text: '다음에는 리버사이드로 달려볼래?',
    },
  ],
  dash: [
    {
      id: 'dash-system',
      sender: 'system',
      sentAt: '어제',
      text: '시민코트 농구 3×3에서 처음 만났어요.',
    },
    {
      id: 'dash-1',
      sender: 'mate',
      sentAt: '어제',
      text: '오늘 패스 좋았어! 다음 경기에서 보자.',
    },
  ],
  mint: [
    {
      id: 'mint-system',
      sender: 'system',
      sentAt: '금',
      text: '주말 플로깅 레이드에서 처음 만났어요.',
    },
    {
      id: 'mint-1',
      sender: 'mate',
      sentAt: '금',
      text: '새 스팟 검증도 같이 가자!',
    },
  ],
}

const SHARE_CARDS: SharedMoveCard[] = [
  {
    kind: 'event',
    title: '리버사이드 이지런',
    meta: '7월 20일 17:00 · 2/6명',
    detail: '조깅 · 초보자 환영 · 30분',
  },
  {
    kind: 'spot',
    title: '리버사이드 러닝 게이트',
    meta: '도보 12분 · 활동 지점 3단계',
    detail: '조명 · 화장실 · 순환코스',
  },
]

const ACTIVITY_OPTIONS = ['조깅', '걷기', '농구', '배드민턴'] as const
const DATE_OPTIONS = [
  { value: '2026-07-20', label: '7월 20일', day: '월' },
  { value: '2026-07-21', label: '7월 21일', day: '화' },
  { value: '2026-07-22', label: '7월 22일', day: '수' },
] as const
const TIME_OPTIONS = ['16:30–17:10', '17:00–17:40', '18:00–18:40'] as const
const SPOT_OPTIONS = [
  { name: '리버사이드 러닝 게이트', detail: '도보 12분 · 조명 있음' },
  { name: '중앙공원 액티브 돔', detail: '도보 8분 · 공개 광장' },
  { name: '시민체육공원 입구', detail: '도보 16분 · 관리시설 인접' },
] as const
const REPORT_REASONS = [
  '반복적으로 연락하거나 압박해요',
  '개인정보를 요구했어요',
  '부적절하거나 위협적인 메시지를 보냈어요',
  '행사 정보와 다른 장소를 요구했어요',
  '학생이 아닌 계정으로 의심돼요',
] as const

function isDmEligible(mate: SocialMate, blockedIds: Set<string>) {
  return (
    mate.isMutual !== false &&
    mate.metThroughActivity !== false &&
    !blockedIds.has(mate.id)
  )
}

function Avatar({ mate, size = 'md' }: { mate: SocialMate; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = {
    sm: 'h-9 w-9 text-xs',
    md: 'h-12 w-12 text-sm',
    lg: 'h-16 w-16 text-lg',
  }[size]
  const tones = [
    'bg-[#caff52] text-[#17352c]',
    'bg-[#263c34] text-white',
    'bg-[#35566b] text-white',
    'bg-[#6d493a] text-white',
  ]
  const toneIndex = [...mate.id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % tones.length
  const initial = mate.nickname.trim().slice(0, 1).toLocaleUpperCase('ko-KR') || 'M'

  return (
    <div
      aria-label={`${mate.nickname} 프로필`}
      role="img"
      className={`${sizeClass} ${tones[toneIndex]} relative grid shrink-0 place-items-center rounded-lg border border-black/5 font-black tracking-[-0.03em]`}
    >
      <span>{initial}</span>
      {mate.status === 'online' ? (
        <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#2b9a72]" />
      ) : null}
    </div>
  )
}

function SharedCard({ card }: { card: SharedMoveCard }) {
  const Icon = card.kind === 'event' ? CalendarDays : MapPin

  return (
    <article className="mt-2 overflow-hidden rounded-xl border border-[#dfe4df] bg-white text-[#202522]">
      <div className={`flex items-center gap-2 px-3.5 py-2.5 ${card.kind === 'event' ? 'bg-[#285c49]' : 'bg-[#3e5a52]'} text-white`}>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/12">
          <Icon aria-hidden="true" className="h-4 w-4" />
        </span>
        <span className="text-[11px] font-extrabold">
          {card.kind === 'event' ? '활동 이벤트' : '공개 활동 장소'}
        </span>
      </div>
      <div className="p-3.5">
        <h4 className="text-sm font-extrabold tracking-[-0.02em]">{card.title}</h4>
        <p className="mt-1 text-[11px] font-bold text-[#55615b]">{card.meta}</p>
        <p className="mt-2 text-xs font-bold text-[#3f4944]">{card.detail}</p>
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#b8c4bd] bg-white px-3 py-2 text-xs font-extrabold text-[#20543f] transition hover:bg-[#f2f4f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285c49]"
        >
          지도에서 보기
          <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  )
}

function ScheduleCard({ schedule }: { schedule: MoveAgainSchedule }) {
  return (
    <article className="mt-2 rounded-xl border border-[#dfe4df] bg-white p-3.5 text-[#202522]">
      <div className="flex items-center gap-2 text-[#285c49]">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#caff52] text-[#17352c]">
          <CalendarCheck2 aria-hidden="true" className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[11px] font-extrabold text-[#55615b]">다음 활동</p>
          <p className="text-sm font-black">{schedule.activity}</p>
        </div>
      </div>
      <dl className="mt-3 grid gap-2 text-xs">
        <div className="flex items-center gap-2">
          <Clock3 aria-hidden="true" className="h-3.5 w-3.5 text-[#55615b]" />
          <dt className="sr-only">일시</dt>
          <dd className="font-bold">{schedule.dateLabel} · {schedule.time}</dd>
        </div>
        <div className="flex items-center gap-2">
          <MapPin aria-hidden="true" className="h-3.5 w-3.5 text-[#55615b]" />
          <dt className="sr-only">장소</dt>
          <dd className="font-bold">{schedule.spot}</dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-[#a9b9b0] bg-white px-3 py-2 text-[11px] font-extrabold text-[#20543f]">
        <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
        승인된 공개 스팟에서 만나요
      </div>
    </article>
  )
}

export function SocialPanel({
  open,
  onClose,
  onBump,
  mates,
  onScheduleCreated,
  currentUserName = 'NOVA',
}: SocialPanelProps) {
  const socialMates = mates ?? DEMO_MATES
  const [view, setView] = useState<PanelView>('mates')
  const [activeMateId, setActiveMateId] = useState(socialMates[0]?.id ?? '')
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(INITIAL_MESSAGES)
  const [messageDraft, setMessageDraft] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showShareTray, setShowShareTray] = useState(false)
  const [safetyModal, setSafetyModal] = useState<SafetyModal>(null)
  const [blockedIds, setBlockedIds] = useState<Set<string>>(() => new Set())
  const [reportReason, setReportReason] = useState<string>(REPORT_REASONS[0])
  const [toast, setToast] = useState<string | null>(null)
  const [activity, setActivity] = useState<string>('조깅')
  const [scheduleDate, setScheduleDate] = useState<string>(DATE_OPTIONS[0].value)
  const [scheduleTime, setScheduleTime] = useState<string>(TIME_OPTIONS[1])
  const [scheduleSpot, setScheduleSpot] = useState<string>(SPOT_OPTIONS[0].name)

  const activeMate = socialMates.find((mate) => mate.id === activeMateId) ?? socialMates[0]
  const activeMessages = activeMate ? messages[activeMate.id] ?? [] : []

  const filteredMates = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('ko-KR')
    if (!normalizedQuery) return socialMates

    return socialMates.filter((mate) => {
      const searchable = [mate.nickname, mate.lastActivity, ...(mate.sports ?? [])]
        .join(' ')
        .toLocaleLowerCase('ko-KR')
      return searchable.includes(normalizedQuery)
    })
  }, [searchQuery, socialMates])

  const recommendedAvailability = useMemo(
    () => activeMate?.availability?.filter((slot) => slot.date === scheduleDate) ?? [],
    [activeMate, scheduleDate],
  )

  const containsPrivateInfo = /(?:01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}|카톡|카카오|인스타|주소|학교명)/i.test(
    messageDraft,
  )

  useEffect(() => {
    if (!open) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (safetyModal) {
        setSafetyModal(null)
        return
      }
      onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose, open, safetyModal])

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }

  const openConversation = (mate: SocialMate) => {
    if (!isDmEligible(mate, blockedIds)) {
      showToast('함께 활동하고 서로 연결된 메이트만 대화할 수 있어요.')
      return
    }
    setActiveMateId(mate.id)
    setShowShareTray(false)
    setView('chat')
  }

  const sendMessage = () => {
    if (!activeMate || !messageDraft.trim()) return
    if (!isDmEligible(activeMate, blockedIds)) {
      showToast('현재 이 메이트에게 메시지를 보낼 수 없어요.')
      return
    }

    if (containsPrivateInfo) {
      showToast('개인정보가 포함되지 않았는지 한 번 더 확인해 주세요.')
      return
    }

    const nextMessage: ChatMessage = {
      id: `${activeMate.id}-text-${(messages[activeMate.id]?.length ?? 0) + 1}`,
      sender: 'me',
      sentAt: '방금',
      text: messageDraft.trim(),
    }
    setMessages((current) => ({
      ...current,
      [activeMate.id]: [...(current[activeMate.id] ?? []), nextMessage],
    }))
    setMessageDraft('')
  }

  const shareCard = (card: SharedMoveCard) => {
    if (!activeMate) return
    const nextMessage: ChatMessage = {
      id: `${activeMate.id}-card-${(messages[activeMate.id]?.length ?? 0) + 1}`,
      sender: 'me',
      sentAt: '방금',
      card,
    }
    setMessages((current) => ({
      ...current,
      [activeMate.id]: [...(current[activeMate.id] ?? []), nextMessage],
    }))
    setShowShareTray(false)
    showToast(`${card.kind === 'event' ? '이벤트' : '스팟'} 카드를 공유했어요.`)
  }

  const createSchedule = () => {
    if (!activeMate) return
    const dateOption = DATE_OPTIONS.find((date) => date.value === scheduleDate)
    const schedule: MoveAgainSchedule = {
      mateId: activeMate.id,
      mateNickname: activeMate.nickname,
      activity,
      date: scheduleDate,
      dateLabel: dateOption ? `${dateOption.label} · ${dateOption.day}` : scheduleDate,
      time: scheduleTime,
      spot: scheduleSpot,
    }
    const nextMessage: ChatMessage = {
      id: `${activeMate.id}-schedule-${(messages[activeMate.id]?.length ?? 0) + 1}`,
      sender: 'me',
      sentAt: '방금',
      schedule,
    }
    setMessages((current) => ({
      ...current,
      [activeMate.id]: [...(current[activeMate.id] ?? []), nextMessage],
    }))
    onScheduleCreated?.(schedule)
    setView('chat')
    showToast('다음 활동 제안을 보냈어요.')
  }

  const blockMate = () => {
    if (!activeMate) return
    setBlockedIds((current) => new Set(current).add(activeMate.id))
    setSafetyModal(null)
    setView('mates')
    showToast(`${activeMate.nickname}님을 차단했어요. 서로의 활동에서 보이지 않아요.`)
  }

  const submitReport = () => {
    if (!activeMate) return
    setBlockedIds((current) => new Set(current).add(activeMate.id))
    setSafetyModal(null)
    setView('mates')
    showToast('신고가 접수됐어요. 즉시 대화를 숨기고 안전팀이 확인할게요.')
  }

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          aria-label="소셜 패널 배경"
          className="absolute inset-0 z-[80] flex justify-end bg-[#111914]/45"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) onClose()
          }}
        >
          <motion.section
            aria-labelledby="social-panel-title"
            aria-modal="true"
            role="dialog"
            className="relative flex h-full w-full max-w-[480px] flex-col overflow-hidden bg-[#050706] text-[#f7faf8] shadow-[-12px_0_32px_rgba(0,0,0,0.42)]"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <AnimatePresence mode="wait" initial={false}>
              {view === 'mates' ? (
                <motion.div
                  key="mates"
                  className="flex min-h-0 flex-1 flex-col"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}
                >
                  <header className="bg-[#050706] px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] text-white">
                    <div className="flex items-center justify-between">
                      <h2 id="social-panel-title" className="text-[27px] font-black tracking-[-0.05em]">
                        메이트 <span className="text-[#caff52]">{socialMates.filter((mate) => isDmEligible(mate, blockedIds)).length}</span>
                      </h2>
                      <button
                        type="button"
                        aria-label="소셜 패널 닫기"
                        onClick={onClose}
                        className="grid h-11 w-11 place-items-center rounded-xl bg-[#151a17] text-white transition hover:bg-[#202722] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#caff52]"
                      >
                        <X aria-hidden="true" className="h-5 w-5" />
                      </button>
                    </div>

                  </header>

                  <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-1">
                    {onBump ? (
                      <button
                        type="button"
                        onClick={onBump}
                        className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-[#111512] p-3 text-left transition hover:bg-[#171d18] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#caff52]"
                      >
                        <Image src="/moverse-bump-orb.png" alt="" width={58} height={58} className="h-[58px] w-[58px] scale-150 object-contain" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] font-black tracking-[0.16em] text-[#56e1d2]">FACE TO FACE</span>
                          <span className="mt-0.5 block text-xl font-black tracking-[-0.04em]">BUMP</span>
                          <span className="block text-[11px] font-bold text-[#a4aea9]">현장에서 서로 확인</span>
                        </span>
                        <ChevronRight aria-hidden="true" className="h-5 w-5 text-[#caff52]" />
                      </button>
                    ) : null}

                    <div className="relative">
                      <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a948f]" />
                      <label className="sr-only" htmlFor="mate-search">메이트 검색</label>
                      <input
                        id="mate-search"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="메이트 검색"
                        className="h-11 w-full rounded-xl border border-white/10 bg-[#111512] pl-10 pr-4 text-sm font-bold text-white outline-none transition placeholder:font-semibold placeholder:text-[#7f8984] focus:border-[#caff52] focus:ring-2 focus:ring-[#caff52]/15"
                      />
                    </div>

                    <section aria-label="안전한 연결 안내" className="mt-3 flex items-center gap-2 px-1 text-[11px] font-bold text-[#a4aea9]">
                      <ShieldCheck aria-hidden="true" className="h-4 w-4 text-[#caff52]" />
                      <p>서로 수락한 메이트만 대화</p>
                    </section>

                    <div className="mb-2 mt-6 flex items-end justify-between px-1">
                      <h3 className="text-[13px] font-black tracking-[0.08em] text-[#a4aea9]">MY MATES</h3>
                      <span className="text-xs font-black text-white">{filteredMates.length}</span>
                    </div>

                    <div className="grid gap-2">
                      {filteredMates.map((mate) => {
                        const eligible = isDmEligible(mate, blockedIds)
                        return (
                          <button
                            key={mate.id}
                            type="button"
                            onClick={() => openConversation(mate)}
                            className="group flex min-h-[74px] w-full items-center gap-3 rounded-2xl bg-[#0d110f] p-3 text-left text-white transition hover:bg-[#151a17] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#caff52]"
                          >
                            <Avatar mate={mate} />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="text-sm font-black tracking-[-0.02em]">{mate.nickname}</span>
                                <span className="text-[10px] font-black text-[#8f9994]">LV.{mate.level ?? 1}</span>
                              </span>
                              <span className="mt-1 block truncate text-xs font-semibold text-[#a4aea9]">
                                {blockedIds.has(mate.id) ? '차단한 메이트' : mate.lastMessage ?? mate.lastActivity ?? '함께한 활동에서 다시 만나요'}
                              </span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-2">
                              <span className="text-[10px] font-bold text-[#7f8984]">{mate.lastMessageAt ?? ''}</span>
                              <span className={`grid h-8 w-8 place-items-center rounded-xl ${eligible ? 'bg-[#caff52] text-[#101410]' : 'bg-[#1d231f] text-[#717b76]'}`}>
                                {eligible ? <ChevronRight aria-hidden="true" className="h-4 w-4" /> : <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />}
                              </span>
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    {filteredMates.length === 0 ? (
                      <div className="py-14 text-center">
                        <span className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-[#151a17] text-[#caff52]">
                          <Users aria-hidden="true" className="h-6 w-6" />
                        </span>
                        <p className="mt-4 text-sm font-extrabold">찾는 메이트가 없어요</p>
                        <p className="mt-1 text-xs font-semibold text-[#8f9994]">검색어를 다시 확인해 보세요.</p>
                      </div>
                    ) : null}
                  </main>
                </motion.div>
              ) : null}

              {view === 'chat' && activeMate ? (
                <motion.div
                  key={`chat-${activeMate.id}`}
                  className="flex min-h-0 flex-1 flex-col"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.18 }}
                >
                  <header className="border-b border-white/10 bg-[#050706] px-3 pb-3 pt-[max(0.8rem,env(safe-area-inset-top))] text-white">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="메이트 목록으로 돌아가기"
                        onClick={() => setView('mates')}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#a4aea9] transition hover:bg-[#151a17] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#caff52]"
                      >
                        <ChevronLeft aria-hidden="true" className="h-5 w-5" />
                      </button>
                      <Avatar mate={activeMate} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h2 className="truncate text-sm font-black">{activeMate.nickname}</h2>
                          <span title="학생 인증 완료" className="text-[#35b88a]">
                            <ShieldCheck aria-label="학생 인증 완료" className="h-3.5 w-3.5" />
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] font-bold text-[#a4aea9]">함께한 활동 {activeMate.sharedActivities ?? 1}회 · {activeMate.status === 'online' ? '지금 활동 중' : '메이트'}</p>
                      </div>
                      <button
                        type="button"
                        aria-label={`${activeMate.nickname} 안전 메뉴 열기`}
                        onClick={() => setSafetyModal('menu')}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#a4aea9] transition hover:bg-[#151a17] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#caff52]"
                      >
                        <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#151a17] px-3 py-2 text-[11px] font-extrabold text-[#caff52]">
                      <UserRoundCheck aria-hidden="true" className="h-3.5 w-3.5" />
                      {activeMate.lastActivity ?? '공개 활동'}에서 직접 만나 연결됐어요
                    </div>
                  </header>

                  <main
                    aria-label={`${activeMate.nickname}님과의 대화`}
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#050706] px-4 py-4"
                  >
                    <div className="mx-auto mb-5 flex max-w-[320px] items-start gap-2 rounded-xl bg-[#111512] p-3">
                      <LockKeyhole aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#caff52]" />
                      <p className="text-[11px] font-semibold leading-relaxed text-[#a4aea9]">
                        연락처·학교·실시간 위치는 보내지 마세요.
                      </p>
                    </div>

                    <div className="grid gap-3" aria-live="polite">
                      {activeMessages.map((message) => {
                        if (message.sender === 'system') {
                          return (
                            <div key={message.id} className="mx-auto max-w-[310px] rounded-lg border border-white/10 bg-[#111512] px-3 py-2 text-center text-[11px] font-bold leading-relaxed text-[#a4aea9]">
                              {message.text}
                            </div>
                          )
                        }

                        const isMine = message.sender === 'me'
                        return (
                          <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <div className="max-w-[82%]">
                              {message.text ? (
                                <div
                                  aria-label={`${isMine ? currentUserName : activeMate.nickname}의 메시지`}
                                  className={`rounded-2xl px-3.5 py-2.5 text-[13px] font-semibold leading-relaxed ${isMine ? 'rounded-br-sm bg-[#caff52] text-[#0c110d]' : 'rounded-bl-sm bg-[#151a17] text-[#f7faf8]'}`}
                                >
                                  {message.text}
                                </div>
                              ) : null}
                              {message.card ? <SharedCard card={message.card} /> : null}
                              {message.schedule ? <ScheduleCard schedule={message.schedule} /> : null}
                              <p className={`mt-1 px-1 text-[10px] font-bold text-[#7f8984] ${isMine ? 'text-right' : 'text-left'}`}>{message.sentAt}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </main>

                  <AnimatePresence initial={false}>
                    {showShareTray ? (
                      <motion.section
                        aria-label="활동 카드 공유"
                        className="border-t border-[#dfe4df] bg-white px-4 py-3"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-black">활동 카드 공유</p>
                          <button
                            type="button"
                            aria-label="공유 카드 닫기"
                            onClick={() => setShowShareTray(false)}
                            className="grid h-7 w-7 place-items-center rounded-lg bg-[#f2f2f7] text-[#77798d]"
                          >
                            <X aria-hidden="true" className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {SHARE_CARDS.map((card) => {
                            const Icon = card.kind === 'event' ? CalendarDays : MapPin
                            return (
                              <button
                                key={card.kind}
                                type="button"
                                onClick={() => shareCard(card)}
                                className="rounded-xl border border-[#c7cfca] bg-white p-3 text-left transition hover:border-[#789083] hover:bg-[#fafbfa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6d55]"
                              >
                                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#caff52] text-[#17352c]">
                                  <Icon aria-hidden="true" className="h-4 w-4" />
                                </span>
                                <span className="mt-2 block text-[11px] font-black">{card.kind === 'event' ? '이벤트 공유' : '스팟 공유'}</span>
                                <span className="mt-0.5 block truncate text-[10px] font-bold text-[#55615b]">{card.title}</span>
                              </button>
                            )
                          })}
                        </div>
                      </motion.section>
                    ) : null}
                  </AnimatePresence>

                  <footer className="shrink-0 border-t border-white/10 bg-[#050706] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2.5">
                    {containsPrivateInfo ? (
                      <div className="mb-2 flex items-center gap-2 rounded-xl bg-[#fff3ec] px-3 py-2 text-[10px] font-extrabold text-[#b3562e]" role="alert">
                        <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                        개인정보로 보이는 내용이 있어요. 공개 스팟 약속 기능을 이용해 주세요.
                      </div>
                    ) : null}
                    <div className="flex items-end gap-2">
                      <button
                        type="button"
                        aria-label="이벤트 또는 스팟 공유"
                        aria-expanded={showShareTray}
                        onClick={() => setShowShareTray((current) => !current)}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#caff52] text-[#0c110d] transition hover:bg-[#b8ed45] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#caff52]"
                      >
                        <Share2 aria-hidden="true" className="h-4.5 w-4.5" />
                      </button>
                      <label className="sr-only" htmlFor="message-draft">메시지 입력</label>
                      <textarea
                        id="message-draft"
                        value={messageDraft}
                        onChange={(event) => setMessageDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault()
                            sendMessage()
                          }
                        }}
                        rows={1}
                        placeholder="안전하게 메시지 보내기"
                        className="min-h-11 max-h-28 flex-1 resize-none rounded-xl border border-white/10 bg-[#111512] px-3.5 py-3 text-[13px] font-semibold leading-5 text-white outline-none transition placeholder:font-semibold placeholder:text-[#7f8984] focus:border-[#caff52] focus:ring-2 focus:ring-[#caff52]/15"
                      />
                      <button
                        type="button"
                        aria-label="메시지 보내기"
                        onClick={sendMessage}
                        disabled={!messageDraft.trim()}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#caff52] text-[#0c110d] transition hover:bg-[#b8ed45] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#caff52]"
                      >
                        <Send aria-hidden="true" className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setView('schedule')}
                      className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#151a17] px-4 py-3 text-xs font-extrabold text-white transition hover:bg-[#202722] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#caff52]"
                    >
                      <CalendarCheck2 aria-hidden="true" className="h-4 w-4 text-[#caff52]" />
                      다음 활동 잡기
                    </button>
                  </footer>
                </motion.div>
              ) : null}

              {view === 'schedule' && activeMate ? (
                <motion.div
                  key="schedule"
                  className="flex min-h-0 flex-1 flex-col bg-[#f7f7f5]"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.18 }}
                >
                  <header className="border-b border-[#29483d] bg-[#17352c] px-4 pb-5 pt-[max(0.9rem,env(safe-area-inset-top))] text-white">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="대화로 돌아가기"
                        onClick={() => setView('chat')}
                        className="grid h-10 w-10 place-items-center rounded-lg border border-white/20 text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      >
                        <ChevronLeft aria-hidden="true" className="h-5 w-5" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-extrabold text-white/75">다시 만나기</p>
                        <h2 className="mt-0.5 truncate text-xl font-black tracking-[-0.035em]">{activeMate.nickname}와 다음 활동</h2>
                      </div>
                      <Avatar mate={activeMate} size="sm" />
                    </div>
                    <p className="mt-4 max-w-[330px] text-xs font-semibold leading-relaxed text-white/72">
                      각자의 전체 일정은 숨기고, 겹치는 시간과 공개 활동 장소만 공유해요.
                    </p>
                  </header>

                  <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 pb-8">
                    <section>
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#caff52] text-[#17352c]">
                          <Dumbbell aria-hidden="true" className="h-3.5 w-3.5" />
                        </span>
                        <div>
                          <h3 className="text-sm font-black">무엇을 함께 할까요?</h3>
                          <p className="text-[11px] font-semibold text-[#55615b]">가볍게 시작해도 충분해요</p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-4 gap-2">
                        {ACTIVITY_OPTIONS.map((option) => (
                          <button
                            key={option}
                            type="button"
                            aria-pressed={activity === option}
                            onClick={() => setActivity(option)}
                            className={`rounded-lg px-2 py-2.5 text-[11px] font-extrabold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6d55] ${activity === option ? 'bg-[#17352c] text-[#caff52]' : 'border border-[#cbd2ce] bg-white text-[#46524c] hover:border-[#789083]'}`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="mt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#caff52] text-[#17352c]">
                            <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
                          </span>
                          <h3 className="text-sm font-black">날짜와 시간</h3>
                        </div>
                        <span className="flex items-center gap-1 rounded-md bg-[#caff52] px-2 py-1 text-[10px] font-extrabold text-[#17352c]">
                          <Check aria-hidden="true" className="h-3 w-3" />
                          겹치는 시간 추천
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {DATE_OPTIONS.map((date) => (
                          <button
                            key={date.value}
                            type="button"
                            aria-pressed={scheduleDate === date.value}
                            onClick={() => {
                              setScheduleDate(date.value)
                              const matched = activeMate.availability?.find((slot) => slot.date === date.value)
                              if (matched) setScheduleTime(matched.time)
                            }}
                            className={`rounded-lg border p-3 text-center transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6d55] ${scheduleDate === date.value ? 'border-[#17352c] bg-[#17352c] text-white' : 'border-[#cbd2ce] bg-white hover:border-[#789083]'}`}
                          >
                            <span className={`block text-[11px] font-bold ${scheduleDate === date.value ? 'text-[#caff52]' : 'text-[#55615b]'}`}>{date.day}</span>
                            <span className="mt-1 block text-xs font-black">{date.label.replace('7월 ', '')}</span>
                          </button>
                        ))}
                      </div>

                      {recommendedAvailability.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setScheduleTime(recommendedAvailability[0].time)}
                          className="mt-3 flex w-full items-center gap-3 rounded-lg border border-[#17352c] bg-[#17352c] p-3 text-left text-white transition hover:bg-[#21483c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6d55]"
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#caff52] text-[#17352c]">
                            <Check aria-hidden="true" className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[11px] font-extrabold text-white/75">둘 다 가능한 시간이 있어요</span>
                            <span className="mt-0.5 block text-sm font-black text-white">{recommendedAvailability[0].time}</span>
                          </span>
                          <span className="rounded-md bg-[#caff52] px-2 py-1 text-[10px] font-extrabold text-[#17352c]">추천</span>
                        </button>
                      ) : (
                        <div className="mt-3 rounded-lg border border-[#e5dfd2] bg-[#faf7ef] p-3 text-[11px] font-semibold leading-relaxed text-[#7b6d52]">
                          이 날은 등록된 겹치는 시간이 없어요. 다른 시간으로 제안하면 상대가 가능한 시간을 선택할 수 있어요.
                        </div>
                      )}

                      <div className="mt-3 grid gap-2">
                        {TIME_OPTIONS.map((time) => {
                          const isRecommended = recommendedAvailability.some((slot) => slot.time === time)
                          return (
                            <button
                              key={time}
                              type="button"
                              aria-pressed={scheduleTime === time}
                              onClick={() => setScheduleTime(time)}
                              className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6d55] ${scheduleTime === time ? 'border-[#17352c] bg-[#17352c] text-white' : 'border-[#cbd2ce] bg-white hover:border-[#789083]'}`}
                            >
                              <span className="flex items-center gap-2 text-xs font-extrabold">
                                <Clock3 aria-hidden="true" className={`h-3.5 w-3.5 ${scheduleTime === time ? 'text-[#caff52]' : 'text-[#55615b]'}`} />
                                {time}
                              </span>
                              {isRecommended ? <span className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold ${scheduleTime === time ? 'bg-[#caff52] text-[#17352c]' : 'bg-[#17352c] text-white'}`}>시간 겹침</span> : null}
                            </button>
                          )
                        })}
                      </div>
                    </section>

                    <section className="mt-6">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#caff52] text-[#17352c]">
                          <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
                        </span>
                        <div>
                          <h3 className="text-sm font-black">안전한 공개 장소</h3>
                          <p className="text-[11px] font-semibold text-[#55615b]">개인 위치 대신 승인된 공개 장소를 공유해요</p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {SPOT_OPTIONS.map((spot) => (
                          <button
                            key={spot.name}
                            type="button"
                            aria-pressed={scheduleSpot === spot.name}
                            onClick={() => setScheduleSpot(spot.name)}
                            className={`flex items-center gap-3 rounded-lg border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6d55] ${scheduleSpot === spot.name ? 'border-[#17352c] bg-[#17352c] text-white' : 'border-[#cbd2ce] bg-white hover:border-[#789083]'}`}
                          >
                            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${scheduleSpot === spot.name ? 'bg-[#caff52] text-[#17352c]' : 'bg-[#e1e4e2] text-[#46524c]'}`}>
                              <MapPin aria-hidden="true" className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-black">{spot.name}</span>
                              <span className={`mt-0.5 block truncate text-[11px] font-semibold ${scheduleSpot === spot.name ? 'text-white/75' : 'text-[#55615b]'}`}>{spot.detail}</span>
                            </span>
                            {scheduleSpot === spot.name ? <Check aria-hidden="true" className="h-4 w-4 text-[#caff52]" /> : null}
                          </button>
                        ))}
                      </div>
                    </section>

                    <div className="mt-5 flex items-start gap-2 rounded-lg border border-[#aebbb4] bg-white p-3 text-[11px] font-bold leading-relaxed text-[#33483e]">
                      <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                      상대에게는 선택한 스팟과 시간만 보여요. 집, 학교, 현재 위치는 절대 공유되지 않아요.
                    </div>
                  </main>

                  <footer className="shrink-0 border-t border-[#dfe4df] bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
                    <div className="mb-3 flex items-center justify-between text-[11px] font-bold text-[#55615b]">
                      <span>{activity} · {scheduleTime}</span>
                      <span className="max-w-[190px] truncate">{scheduleSpot}</span>
                    </div>
                    <button
                      type="button"
                      onClick={createSchedule}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#28654e] px-4 py-3.5 text-sm font-black text-white transition hover:bg-[#1f563f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#28654e]"
                    >
                      <Send aria-hidden="true" className="h-4 w-4" />
                      {activeMate.nickname}에게 일정 제안 보내기
                    </button>
                  </footer>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {safetyModal && activeMate ? (
                <motion.div
                  className="absolute inset-0 z-30 flex items-end bg-[#111914]/55 px-3 pb-[max(0.8rem,env(safe-area-inset-bottom))]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onMouseDown={(event) => {
                    if (event.currentTarget === event.target) setSafetyModal(null)
                  }}
                >
                  <motion.section
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="safety-modal-title"
                    className="w-full overflow-hidden rounded-xl bg-white shadow-[0_16px_40px_rgba(15,25,20,0.26)]"
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 40, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 390, damping: 31 }}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    {safetyModal === 'menu' ? (
                      <>
                        <div className="flex items-center justify-between border-b border-[#cfd5d1] px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#caff52] text-[#17352c]">
                              <Shield aria-hidden="true" className="h-5 w-5" />
                            </span>
                            <div>
                              <h3 id="safety-modal-title" className="text-sm font-black">대화 안전 관리</h3>
                              <p className="mt-0.5 text-[11px] font-semibold text-[#55615b]">{activeMate.nickname}와의 연결</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            aria-label="안전 메뉴 닫기"
                            onClick={() => setSafetyModal(null)}
                            className="grid h-9 w-9 place-items-center rounded-xl bg-[#f3f3f7] text-[#77798a]"
                          >
                            <X aria-hidden="true" className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid gap-2 p-3">
                          <button
                            type="button"
                            onClick={() => setSafetyModal('block')}
                            className="flex items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-[#f1f2f0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6d55]"
                          >
                            <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#e1e4e2] text-[#46524c]">
                              <Ban aria-hidden="true" className="h-4.5 w-4.5" />
                            </span>
                            <span className="flex-1">
                              <span className="block text-xs font-black">차단하기</span>
                              <span className="mt-0.5 block text-[11px] font-semibold text-[#55615b]">서로의 활동·메시지·위치 신호가 숨겨져요</span>
                            </span>
                            <ChevronRight aria-hidden="true" className="h-4 w-4 text-[#aaa]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSafetyModal('report')}
                            className="flex items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-[#fff3f0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d85b42]"
                          >
                            <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#fff0ec] text-[#d4563d]">
                              <Flag aria-hidden="true" className="h-4.5 w-4.5" />
                            </span>
                            <span className="flex-1">
                              <span className="block text-xs font-black text-[#b64734]">신고하고 대화 숨기기</span>
                              <span className="mt-0.5 block text-[11px] font-semibold text-[#80564e]">위험한 행동을 안전팀에 알려요</span>
                            </span>
                            <ChevronRight aria-hidden="true" className="h-4 w-4 text-[#d9a098]" />
                          </button>
                        </div>
                      </>
                    ) : null}

                    {safetyModal === 'block' ? (
                      <div className="p-5 text-center">
                        <span className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-[#e1e4e2] text-[#46524c]">
                          <Ban aria-hidden="true" className="h-6 w-6" />
                        </span>
                        <h3 id="safety-modal-title" className="mt-4 text-base font-black">{activeMate.nickname}님을 차단할까요?</h3>
                        <p className="mx-auto mt-2 max-w-[290px] text-xs font-semibold leading-relaxed text-[#55615b]">
                          상대에게 알림은 가지 않아요. 서로의 활동과 대화가 즉시 숨겨지고, 언제든 안전 설정에서 해제할 수 있어요.
                        </p>
                        <div className="mt-5 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setSafetyModal(null)}
                            className="rounded-lg border border-[#dfe4df] px-4 py-3 text-xs font-extrabold text-[#656e68] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6d55]"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            onClick={blockMate}
                            className="rounded-lg bg-[#26342d] px-4 py-3 text-xs font-extrabold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26342d]"
                          >
                            차단하기
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {safetyModal === 'report' ? (
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[11px] font-extrabold text-[#c84f39]">안전 신고</p>
                            <h3 id="safety-modal-title" className="mt-1 text-base font-black">무슨 일이 있었나요?</h3>
                          </div>
                          <button
                            type="button"
                            aria-label="신고 창 닫기"
                            onClick={() => setSafetyModal(null)}
                            className="grid h-9 w-9 place-items-center rounded-xl bg-[#f3f3f7] text-[#77798a]"
                          >
                            <X aria-hidden="true" className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="mt-2 text-[11px] font-semibold leading-relaxed text-[#55615b]">신고 사실은 상대에게 공개되지 않으며, 접수 즉시 대화를 숨길 수 있어요.</p>
                        <fieldset className="mt-4 grid gap-2">
                          <legend className="sr-only">신고 사유</legend>
                          {REPORT_REASONS.map((reason) => (
                            <label key={reason} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-[11px] font-bold transition ${reportReason === reason ? 'border-[#e8826c] bg-[#fff4f1] text-[#a64331]' : 'border-[#e2e5e2] bg-white text-[#626b65]'}`}>
                              <input
                                type="radio"
                                name="report-reason"
                                value={reason}
                                checked={reportReason === reason}
                                onChange={() => setReportReason(reason)}
                                className="h-4 w-4 accent-[#d4563d]"
                              />
                              {reason}
                            </label>
                          ))}
                        </fieldset>
                        <button
                          type="button"
                          onClick={submitReport}
                          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#c84f39] px-4 py-3 text-xs font-extrabold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c84f39]"
                        >
                          <Flag aria-hidden="true" className="h-4 w-4" />
                          신고 접수하고 대화 숨기기
                        </button>
                      </div>
                    ) : null}
                  </motion.section>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {toast ? (
                <motion.div
                  role="status"
                  aria-live="polite"
                  className="pointer-events-none absolute bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg bg-[#202b25] px-4 py-3 text-center text-[11px] font-extrabold leading-relaxed text-white shadow-[0_12px_28px_rgba(15,25,20,0.24)]"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                >
                  {toast}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export default SocialPanel
