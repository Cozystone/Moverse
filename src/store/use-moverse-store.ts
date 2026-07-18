"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEMO_EVENTS, DEMO_MATES, DEMO_SPOTS } from "@/data/demo-data";
import type { ActivityRecord, MoveEvent, MoveMate, SportType } from "@/types/moverse";

type MoverseState = {
  hydrated: boolean;
  hasOnboarded: boolean;
  nickname: string;
  verified: boolean;
  favoriteSports: SportType[];
  level: number;
  xp: number;
  energy: number;
  coin: number;
  hostXp: number;
  rhythm: number;
  events: MoveEvent[];
  joinedEventIds: string[];
  mates: MoveMate[];
  activities: ActivityRecord[];
  setHydrated: (value: boolean) => void;
  finishOnboarding: (sports: SportType[]) => void;
  joinEvent: (eventId: string, deposit: number) => boolean;
  completeEvent: (event: MoveEvent) => void;
  addEvent: (event: MoveEvent) => void;
  addMate: (mate: MoveMate) => void;
  addEnergy: (amount: number) => void;
  resetDemo: () => void;
};

const initialState = {
  hasOnboarded: false,
  nickname: "NOVA",
  verified: true,
  favoriteSports: ["running", "basketball", "badminton"] as SportType[],
  level: 7,
  xp: 1840,
  energy: 64,
  coin: 280,
  hostXp: 68,
  rhythm: 2,
  events: DEMO_EVENTS,
  joinedEventIds: [] as string[],
  mates: DEMO_MATES,
  activities: [] as ActivityRecord[],
};

function mergeSeedEvents(persistedEvents: MoveEvent[] | undefined) {
  if (!persistedEvents?.length) return DEMO_EVENTS;

  const persistedById = new Map(persistedEvents.map((event) => [event.id, event]));
  const seedIds = new Set(DEMO_EVENTS.map((event) => event.id));
  const validSpotIds = new Set(DEMO_SPOTS.map((spot) => spot.id));
  const userEvents = persistedEvents.filter(
    (event) => !seedIds.has(event.id) && validSpotIds.has(event.spotId),
  );
  const refreshedSeedEvents = DEMO_EVENTS.map((event) => {
    const persisted = persistedById.get(event.id);
    return persisted
      ? {
          ...event,
          participants: persisted.participants,
          status: persisted.status,
        }
      : event;
  });

  return [...userEvents, ...refreshedSeedEvents];
}

export const useMoverseStore = create<MoverseState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      ...initialState,
      setHydrated: (value) => set({ hydrated: value }),
      finishOnboarding: (sports) =>
        set({ hasOnboarded: true, favoriteSports: sports.length ? sports : initialState.favoriteSports }),
      joinEvent: (eventId, deposit) => {
        const state = get();
        if (state.joinedEventIds.includes(eventId)) return true;
        if (state.coin < deposit) return false;
        set({
          coin: state.coin - deposit,
          joinedEventIds: [...state.joinedEventIds, eventId],
          events: state.events.map((event) =>
            event.id === eventId
              ? { ...event, participants: Math.min(event.capacity, event.participants + 1) }
              : event,
          ),
        });
        return true;
      },
      completeEvent: (event) => {
        const state = get();
        const depositReturn = state.joinedEventIds.includes(event.id) ? event.deposit : 0;
        const alreadyCompleted = state.activities.some((activity) => activity.eventId === event.id);
        if (alreadyCompleted) return;
        set({
          coin: state.coin + event.rewardCoin + depositReturn,
          energy: Math.min(100, state.energy + 18),
          xp: state.xp + event.rewardXp,
          rhythm: Math.min(3, state.rhythm + 1),
          events: state.events.map((item) =>
            item.id === event.id ? { ...item, status: "completed" as const } : item,
          ),
          activities: [
            {
              id: `activity-${Date.now()}`,
              eventId: event.id,
              title: event.title,
              sport: event.sport,
              date: "오늘",
              durationMinutes: event.durationMinutes,
              coin: event.rewardCoin,
              xp: event.rewardXp,
            },
            ...state.activities,
          ],
        });
      },
      addEvent: (event) => {
        const state = get();
        set({
          events: [event, ...state.events],
          coin: Math.max(0, state.coin - event.hostCost),
          hostXp: Math.min(100, state.hostXp + 8),
        });
      },
      addMate: (mate) => {
        const state = get();
        if (state.mates.some((item) => item.id === mate.id)) return;
        set({ mates: [mate, ...state.mates] });
      },
      addEnergy: (amount) => set((state) => ({ energy: Math.min(100, state.energy + amount) })),
      resetDemo: () => set({ ...initialState, hydrated: true }),
    }),
    {
      name: "moverse-demo-v1",
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<MoverseState>;
        return {
          ...currentState,
          ...persisted,
          hydrated: false,
          events: mergeSeedEvents(persisted.events),
        };
      },
      partialize: (state) => ({
        hasOnboarded: state.hasOnboarded,
        nickname: state.nickname,
        favoriteSports: state.favoriteSports,
        level: state.level,
        xp: state.xp,
        energy: state.energy,
        coin: state.coin,
        hostXp: state.hostXp,
        rhythm: state.rhythm,
        events: state.events,
        joinedEventIds: state.joinedEventIds,
        mates: state.mates,
        activities: state.activities,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);
