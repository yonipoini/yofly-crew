import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { UserScopedStorage } from './UserScopedStorage';
import type { ProfileState } from '../context/ProfileContext';
import type {
  DerivedScheduleContext,
  ImportedSchedule,
  ImportedScheduleLeg,
  ImportedScheduleSourceDetails,
} from '../types/schedule';

const STORAGE_KEY = 'yofly.schedule-import';
const AIRPORT_CODE_REGEX = /^[A-Z]{3}$/;
const MONTH_INDEX: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};
const CREW_CALENDAR_HINTS = ['crewhub', 'crew', 'trip', 'roster', 'schedule', 'southwest', 'swa'];

export interface ImportableCrewCalendar {
  id: string;
  title: string;
  sourceName: string;
  ownerName?: string;
  color?: string;
  platformLabel: string;
  isRecommended: boolean;
  matchScore: number;
  matchReason?: string;
}

const normalizeCode = (value: string | undefined) => value?.trim().toUpperCase() ?? '';

const normalizeTime = (value: string | undefined) => {
  if (!value) {
    return '';
  }

  const trimmed = value.trim().toUpperCase().replace(/\./g, '');
  const twelveHourMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (twelveHourMatch) {
    const hours = Number(twelveHourMatch[1]);
    const minutes = Number(twelveHourMatch[2]);
    const meridiem = twelveHourMatch[3];
    const normalizedHours = meridiem === 'PM' ? (hours % 12) + 12 : hours % 12;
    return `${String(normalizedHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  const twentyFourHourMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHourMatch) {
    const hours = Number(twentyFourHourMatch[1]);
    const minutes = Number(twentyFourHourMatch[2]);
    if (hours <= 23 && minutes <= 59) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
  }

  return '';
};

const normalizeDate = (value: string | undefined) => {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : '';
};

const toLocalDate = (dateValue: string | undefined, timeValue: string | undefined) => {
  const normalizedTime = normalizeTime(timeValue);
  if (!normalizedTime) {
    return null;
  }

  const normalizedDate = normalizeDate(dateValue) || new Date().toISOString().slice(0, 10);
  const nextDate = new Date(`${normalizedDate}T${normalizedTime}:00`);
  return Number.isNaN(nextDate.getTime()) ? null : nextDate;
};

const normalizeLeg = (leg: Partial<ImportedScheduleLeg>, index: number): ImportedScheduleLeg | null => {
  const departureAirport = normalizeCode(leg.departureAirport);
  const arrivalAirport = normalizeCode(leg.arrivalAirport);

  if (!AIRPORT_CODE_REGEX.test(departureAirport) || !AIRPORT_CODE_REGEX.test(arrivalAirport)) {
    return null;
  }

  return {
    id: leg.id?.trim() || `leg-${index + 1}`,
    date: normalizeDate(leg.date) || undefined,
    reportTime: normalizeTime(leg.reportTime) || undefined,
    departureTime: normalizeTime(leg.departureTime) || undefined,
    arrivalTime: normalizeTime(leg.arrivalTime) || undefined,
    flightNumber: leg.flightNumber?.trim() || undefined,
    departureAirport,
    arrivalAirport,
    rawText: leg.rawText?.trim() || undefined,
    isDeadhead: leg.isDeadhead === true ? true : undefined,
    sourceEventId: leg.sourceEventId?.trim() || undefined,
  };
};

const normalizeSourceDetails = (
  sourceDetails: ImportedScheduleSourceDetails | undefined,
  source: ImportedSchedule['source']
): ImportedScheduleSourceDetails | undefined => {
  if (!sourceDetails && source !== 'calendar') {
    return undefined;
  }

  return {
    platform: sourceDetails?.platform || (Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'unknown'),
    kind: sourceDetails?.kind || source,
    label: sourceDetails?.label?.trim() || undefined,
    calendarId: sourceDetails?.calendarId?.trim() || undefined,
    calendarTitle: sourceDetails?.calendarTitle?.trim() || undefined,
    calendarSource: sourceDetails?.calendarSource?.trim() || undefined,
    calendarOwner: sourceDetails?.calendarOwner?.trim() || undefined,
    eventIds: sourceDetails?.eventIds?.filter(Boolean) || undefined,
    importWindowStart: normalizeDate(sourceDetails?.importWindowStart) || undefined,
    importWindowEnd: normalizeDate(sourceDetails?.importWindowEnd) || undefined,
  };
};

const normalizeSchedule = (
  schedule: Partial<ImportedSchedule>,
  overrides?: {
    imageUri?: string;
    timezone?: string;
    source?: ImportedSchedule['source'];
    sourceDetails?: ImportedScheduleSourceDetails;
  }
): ImportedSchedule => {
  const legs = (schedule.legs || [])
    .map((leg, index) => normalizeLeg(leg, index))
    .filter((leg): leg is ImportedScheduleLeg => Boolean(leg));

  const source = overrides?.source || schedule.source || 'screenshot';

  return {
    id: schedule.id?.trim() || `schedule-${Date.now()}`,
    source,
    importedAt: schedule.importedAt || new Date().toISOString(),
    timezone:
      schedule.timezone?.trim() ||
      overrides?.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    imageUri: overrides?.imageUri || schedule.imageUri,
    rawText: schedule.rawText?.trim() || undefined,
    rawSummary: schedule.rawSummary?.trim() || undefined,
    airlineHint: schedule.airlineHint?.trim() || undefined,
    active: schedule.active !== false,
    legs,
    sourceDetails: normalizeSourceDetails(overrides?.sourceDetails || schedule.sourceDetails, source),
  };
};

const sortLegsChronologically = (legs: ImportedScheduleLeg[]) =>
  [...legs].sort((left, right) => {
    const leftDate = toLocalDate(left.date, left.reportTime || left.departureTime);
    const rightDate = toLocalDate(right.date, right.reportTime || right.departureTime);

    if (!leftDate && !rightDate) {
      return 0;
    }

    if (!leftDate) {
      return 1;
    }

    if (!rightDate) {
      return -1;
    }

    return leftDate.getTime() - rightDate.getTime();
  });

const buildFavoriteAirports = (legs: ImportedScheduleLeg[]) =>
  Array.from(
    new Set(
      legs.flatMap((leg) => [leg.departureAirport, leg.arrivalAirport]).filter((code) => AIRPORT_CODE_REGEX.test(code))
    )
  );

const deriveContext = (schedule: ImportedSchedule, now = new Date()): DerivedScheduleContext | null => {
  const legs = sortLegsChronologically(schedule.legs);
  if (!legs.length) {
    return null;
  }

  for (const leg of legs) {
    const departureAt = toLocalDate(leg.date, leg.reportTime || leg.departureTime);
    const arrivalAt = toLocalDate(leg.date, leg.arrivalTime);

    if (departureAt && now.getTime() <= departureAt.getTime() + 2 * 60 * 60 * 1000) {
      return {
        mode: 'TRIP',
        activeAirport: leg.departureAirport,
        tripAirport: leg.departureAirport,
        layoverAirport: leg.arrivalAirport,
        favoriteAirports: buildFavoriteAirports(legs),
        activeLegId: leg.id,
        summary: `${leg.departureAirport} to ${leg.arrivalAirport}${leg.flightNumber ? ` • ${leg.flightNumber}` : ''}`,
      };
    }

    if (arrivalAt && now.getTime() <= arrivalAt.getTime() + 6 * 60 * 60 * 1000) {
      return {
        mode: 'LAYOVER',
        activeAirport: leg.arrivalAirport,
        tripAirport: leg.departureAirport,
        layoverAirport: leg.arrivalAirport,
        favoriteAirports: buildFavoriteAirports(legs),
        activeLegId: leg.id,
        summary: `${leg.arrivalAirport} layover after ${leg.departureAirport}${leg.flightNumber ? ` • ${leg.flightNumber}` : ''}`,
      };
    }
  }

  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];
  return {
    mode: 'LAYOVER',
    activeAirport: lastLeg.arrivalAirport,
    tripAirport: firstLeg.departureAirport,
    layoverAirport: lastLeg.arrivalAirport,
    favoriteAirports: buildFavoriteAirports(legs),
    activeLegId: lastLeg.id,
    summary: `${firstLeg.departureAirport} trip ending in ${lastLeg.arrivalAirport}`,
  };
};

const cleanCalendarText = (value: string | undefined | null) =>
  (value || '')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const scoreCalendar = (calendar: Calendar.Calendar) => {
  const title = calendar.title?.toLowerCase() || '';
  const sourceName = calendar.source?.name?.toLowerCase() || '';
  const owner = calendar.ownerAccount?.toLowerCase() || '';
  const haystack = `${title} ${sourceName} ${owner}`;
  let matchScore = 0;
  let matchReason = '';

  for (const hint of CREW_CALENDAR_HINTS) {
    if (haystack.includes(hint)) {
      matchScore += hint === 'crewhub' ? 5 : hint === 'southwest' || hint === 'swa' ? 4 : 2;
      if (!matchReason) {
        matchReason = `Matched "${hint}"`;
      }
    }
  }

  if (calendar.isPrimary) {
    matchScore += 1;
  }

  if (calendar.source?.name?.toLowerCase().includes('google')) {
    matchScore += 1;
  }

  return { matchScore, matchReason: matchReason || undefined };
};

const parseMonthDayToIso = (monthLabel: string, dayLabel: string, referenceYear: number) => {
  const monthIndex = MONTH_INDEX[monthLabel.slice(0, 3).toUpperCase()];
  const dayNumber = Number(dayLabel);

  if (monthIndex === undefined || !Number.isFinite(dayNumber)) {
    return '';
  }

  const nextDate = new Date(referenceYear, monthIndex, dayNumber);
  if (Number.isNaN(nextDate.getTime())) {
    return '';
  }

  return nextDate.toISOString().slice(0, 10);
};

const parseCrewNotesLegs = (event: Calendar.Event): ImportedScheduleLeg[] => {
  const lines = cleanCalendarText(event.notes)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const referenceDate = new Date(event.startDate);
  const referenceYear = Number.isNaN(referenceDate.getTime()) ? new Date().getFullYear() : referenceDate.getFullYear();
  let currentDate = referenceDate.toISOString().slice(0, 10);
  let currentReportTime: string | undefined;
  let reportUsedForDate = false;
  let index = 0;
  const legs: ImportedScheduleLeg[] = [];

  for (const line of lines) {
    const dateMatch = line.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)[a-z]*\s+([A-Z][a-z]{2})\s+(\d{1,2})(?:\b|$)/);
    if (dateMatch) {
      currentDate = parseMonthDayToIso(dateMatch[2], dateMatch[3], referenceYear) || currentDate;
      currentReportTime = undefined;
      reportUsedForDate = false;
      continue;
    }

    const reportMatch = line.match(/^Report\s+(\d{1,2}:\d{2})\s+[A-Z]{2,4}$/i);
    if (reportMatch) {
      currentReportTime = normalizeTime(reportMatch[1]) || undefined;
      reportUsedForDate = false;
      continue;
    }

    const legMatch = line.match(
      /^(?:(DH)\s+)?(\d{1,4})\s+([A-Z]{3})\s+(\d{1,2}:\d{2})\s+[A-Z]{2,4}\s+([A-Z]{3})\s+(\d{1,2}:\d{2})\s+[A-Z]{2,4}$/i
    );

    if (!legMatch) {
      continue;
    }

    index += 1;
    legs.push({
      id: `${event.id}-leg-${index}`,
      sourceEventId: event.id,
      date: currentDate,
      reportTime: !reportUsedForDate ? currentReportTime : undefined,
      departureTime: normalizeTime(legMatch[4]) || undefined,
      arrivalTime: normalizeTime(legMatch[6]) || undefined,
      flightNumber: legMatch[2],
      departureAirport: legMatch[3].toUpperCase(),
      arrivalAirport: legMatch[5].toUpperCase(),
      rawText: line,
      isDeadhead: Boolean(legMatch[1]),
    });

    if (currentReportTime) {
      reportUsedForDate = true;
    }
  }

  return legs;
};

const parseCalendarTitleFallback = (event: Calendar.Event): ImportedScheduleLeg[] => {
  const compactTitle = cleanCalendarText(event.title).replace(/\n/g, ' ').toUpperCase();
  const eventDate = new Date(event.startDate);
  const date = Number.isNaN(eventDate.getTime()) ? undefined : eventDate.toISOString().slice(0, 10);

  const timedRouteMatch = compactTitle.match(
    /(\d{1,2}:\d{2})\s+[A-Z]{2,4}\s+([A-Z]{3})\s+([A-Z]{3})\s+(\d{1,2}:\d{2})\s+[A-Z]{2,4}/
  );
  if (timedRouteMatch) {
    return [
      {
        id: `${event.id}-title-1`,
        sourceEventId: event.id,
        date,
        departureTime: normalizeTime(timedRouteMatch[1]) || undefined,
        arrivalTime: normalizeTime(timedRouteMatch[4]) || undefined,
        departureAirport: timedRouteMatch[2],
        arrivalAirport: timedRouteMatch[3],
        rawText: compactTitle,
      },
    ];
  }

  const routeMatch = compactTitle.match(/\b([A-Z]{3})\s+([A-Z]{3})\b/);
  if (!routeMatch) {
    return [];
  }

  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  return [
    {
      id: `${event.id}-title-1`,
      sourceEventId: event.id,
      date,
      departureTime: Number.isNaN(startDate.getTime()) ? undefined : startDate.toISOString().slice(11, 16),
      arrivalTime: Number.isNaN(endDate.getTime()) ? undefined : endDate.toISOString().slice(11, 16),
      departureAirport: routeMatch[1],
      arrivalAirport: routeMatch[2],
      rawText: compactTitle,
    },
  ];
};

const parseCalendarEvent = (event: Calendar.Event): ImportedScheduleLeg[] => {
  const noteLegs = parseCrewNotesLegs(event);
  if (noteLegs.length) {
    return noteLegs;
  }

  return parseCalendarTitleFallback(event);
};

const dedupeLegs = (legs: ImportedScheduleLeg[]) => {
  const seen = new Set<string>();

  return legs.filter((leg) => {
    const key = [
      leg.date,
      leg.flightNumber,
      leg.departureAirport,
      leg.departureTime,
      leg.arrivalAirport,
      leg.arrivalTime,
      leg.isDeadhead ? 'dh' : 'op',
    ].join('|');

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const buildCalendarLabel = (calendar: Pick<ImportableCrewCalendar, 'platformLabel' | 'title' | 'sourceName'>) =>
  `${calendar.platformLabel} • ${calendar.title}${calendar.sourceName ? ` (${calendar.sourceName})` : ''}`;

const buildCalendarSchedule = (params: {
  calendar: ImportableCrewCalendar;
  events: Calendar.Event[];
  timezone?: string;
  windowStart: Date;
  windowEnd: Date;
}): ImportedSchedule => {
  const legs = dedupeLegs(
    params.events.flatMap((event) => parseCalendarEvent(event)).map((leg, index) => ({
      ...leg,
      id: leg.id || `calendar-leg-${index + 1}`,
    }))
  );

  const rawText = cleanCalendarText(
    params.events
      .map((event) => {
        const header = [cleanCalendarText(event.title), cleanCalendarText(event.notes)].filter(Boolean).join('\n');
        return header;
      })
      .filter(Boolean)
      .join('\n\n')
  );

  return normalizeSchedule(
    {
      id: `schedule-${params.calendar.id}-${Date.now()}`,
      source: 'calendar',
      importedAt: new Date().toISOString(),
      timezone:
        params.timezone ||
        params.events.find((event) => event.timeZone)?.timeZone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      rawText,
      rawSummary: `${params.events.length} calendar events • ${legs.length} parsed legs`,
      airlineHint: 'Southwest CrewHub',
      active: true,
      legs,
    },
    {
      source: 'calendar',
      timezone: params.timezone,
      sourceDetails: {
        platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'unknown',
        kind: 'calendar',
        label: buildCalendarLabel(params.calendar),
        calendarId: params.calendar.id,
        calendarTitle: params.calendar.title,
        calendarSource: params.calendar.sourceName,
        calendarOwner: params.calendar.ownerName,
        eventIds: params.events.map((event) => event.id),
        importWindowStart: params.windowStart.toISOString().slice(0, 10),
        importWindowEnd: params.windowEnd.toISOString().slice(0, 10),
      },
    }
  );
};

const getDefaultWindowStart = () => {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() - 7);
  return nextDate;
};

const getDefaultWindowEnd = () => {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + 180);
  return nextDate;
};

const findCalendarById = async (calendarId: string) => {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return calendars.find((calendar) => calendar.id === calendarId) || null;
};

const refreshStoredCalendarSchedule = async (stored: ImportedSchedule, userId?: string | null) => {
  const sourceDetails = stored.sourceDetails;
  if (!sourceDetails?.calendarId || Platform.OS === 'web') {
    return stored;
  }

  const permission = await Calendar.getCalendarPermissionsAsync();
  if (!permission.granted) {
    return stored;
  }

  const calendar = await findCalendarById(sourceDetails.calendarId);
  if (!calendar) {
    return stored;
  }

  const importableCalendar: ImportableCrewCalendar = {
    id: calendar.id,
    title: calendar.title,
    sourceName: calendar.source?.name || '',
    ownerName: calendar.ownerAccount || undefined,
    color: calendar.color,
    platformLabel:
      Platform.OS === 'ios'
        ? 'Apple Calendar'
        : calendar.source?.name?.toLowerCase().includes('google')
          ? 'Google Calendar'
          : 'Android Calendar',
    isRecommended: true,
    matchScore: 0,
  };

  const windowStart = sourceDetails.importWindowStart ? new Date(sourceDetails.importWindowStart) : getDefaultWindowStart();
  const windowEnd = sourceDetails.importWindowEnd ? new Date(sourceDetails.importWindowEnd) : getDefaultWindowEnd();

  const refreshed = await ScheduleImportService.importFromCalendar({
    calendar: importableCalendar,
    windowStart,
    windowEnd,
  });

  await ScheduleImportService.saveImportedSchedule(refreshed, userId);
  return refreshed;
};

export const ScheduleImportService = {
  async getImportedSchedule(userId?: string | null) {
    const stored = await UserScopedStorage.getItem(STORAGE_KEY, { userId });
    if (!stored) {
      return null;
    }

    try {
      const parsed = normalizeSchedule(JSON.parse(stored) as ImportedSchedule);

      if (parsed.source === 'calendar' && parsed.sourceDetails?.calendarId) {
        try {
          return await refreshStoredCalendarSchedule(parsed, userId);
        } catch (error) {
          console.warn('Failed to refresh imported calendar schedule:', error);
        }
      }

      return parsed;
    } catch (error) {
      console.warn('Failed to parse imported schedule:', error);
      return null;
    }
  },

  async saveImportedSchedule(schedule: ImportedSchedule, userId?: string | null) {
    const normalized = normalizeSchedule(schedule);
    await UserScopedStorage.setItem(STORAGE_KEY, JSON.stringify(normalized), { userId });
    return normalized;
  },

  async clearImportedSchedule(userId?: string | null) {
    await UserScopedStorage.removeItem(STORAGE_KEY, { userId });
  },

  async requestCalendarAccess() {
    if (Platform.OS === 'web') {
      return { granted: false, canAskAgain: false };
    }

    const response = await Calendar.requestCalendarPermissionsAsync();
    return {
      granted: response.granted,
      canAskAgain: response.canAskAgain,
    };
  },

  async getCalendarAccessStatus() {
    if (Platform.OS === 'web') {
      return { granted: false, canAskAgain: false };
    }

    const response = await Calendar.getCalendarPermissionsAsync();
    return {
      granted: response.granted,
      canAskAgain: response.canAskAgain,
    };
  },

  async getImportableCalendars() {
    if (Platform.OS === 'web') {
      return [] as ImportableCrewCalendar[];
    }

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

    return calendars
      .filter((calendar) => calendar.allowsModifications || calendar.isVisible !== false || calendar.isSynced !== false)
      .map((calendar) => {
        const score = scoreCalendar(calendar);

        return {
          id: calendar.id,
          title: calendar.title,
          sourceName: calendar.source?.name || '',
          ownerName: calendar.ownerAccount || undefined,
          color: calendar.color,
          platformLabel:
            Platform.OS === 'ios'
              ? 'Apple Calendar'
              : calendar.source?.name?.toLowerCase().includes('google')
                ? 'Google Calendar'
                : 'Android Calendar',
          isRecommended: score.matchScore >= 4,
          matchScore: score.matchScore,
          matchReason: score.matchReason,
        } satisfies ImportableCrewCalendar;
      })
      .sort((left, right) => {
        if (right.matchScore !== left.matchScore) {
          return right.matchScore - left.matchScore;
        }

        return left.title.localeCompare(right.title);
      });
  },

  async importFromCalendar(params: {
    calendar: ImportableCrewCalendar;
    windowStart?: Date;
    windowEnd?: Date;
    timezone?: string;
  }) {
    if (Platform.OS === 'web') {
      throw new Error('Calendar import is only available on iPhone and Android devices.');
    }

    const windowStart = params.windowStart || getDefaultWindowStart();
    const windowEnd = params.windowEnd || getDefaultWindowEnd();
    const events = await Calendar.getEventsAsync([params.calendar.id], windowStart, windowEnd);
    const schedule = buildCalendarSchedule({
      calendar: params.calendar,
      events,
      timezone: params.timezone,
      windowStart,
      windowEnd,
    });

    if (!schedule.legs.length) {
      throw new Error(
        'We found the calendar, but could not read any usable trip legs yet. Open a CrewHub-synced event that includes trip notes and try again.'
      );
    }

    return schedule;
  },

  async importFromImage(params: {
    imageBase64: string;
    mimeType?: string;
    imageUri?: string;
    timezone?: string;
  }) {
    const { data, error } = await supabase.functions.invoke('schedule-import', {
      body: {
        imageBase64: params.imageBase64,
        mimeType: params.mimeType || 'image/jpeg',
        timezone: params.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        now: new Date().toISOString(),
      },
    });

    if (error) {
      throw new Error(error.message || 'Schedule import failed.');
    }

    const normalized = normalizeSchedule((data as { schedule?: ImportedSchedule })?.schedule || data, {
      imageUri: params.imageUri,
      timezone: params.timezone,
      source: 'screenshot',
      sourceDetails: {
        platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'unknown',
        kind: 'screenshot',
        label: 'Screenshot import',
      },
    });

    if (!normalized.legs.length) {
      throw new Error('We could not find any trip legs in that screenshot yet. Try a clearer image.');
    }

    return normalized;
  },

  getDerivedContext(schedule: ImportedSchedule, now = new Date()) {
    return deriveContext(schedule, now);
  },

  applyImportedSchedule(profile: ProfileState, schedule: ImportedSchedule): ProfileState {
    const derived = deriveContext(schedule);
    if (!derived) {
      return profile;
    }

    return {
      ...profile,
      preferences: {
        ...profile.preferences,
        opsContextMode: derived.mode,
        tripAirport: derived.tripAirport,
        layoverAirport: derived.layoverAirport,
        activeOpsAirport: derived.activeAirport,
        favoriteAirports: Array.from(
          new Set([...profile.preferences.favoriteAirports, ...derived.favoriteAirports, profile.baseAirport].filter(Boolean))
        ),
      },
    };
  },
};
