import {revalidateTag, unstable_cache} from 'next/cache';

type CardRead = 'progress' | 'line99' | 'planning';
const cardTag = (date: string, shift: string) => `telegram-card-v1-${date}-${shift}`;

// This is a read optimization only. Request authorization and validation stay in the route.
export function isTelegramCardPoll(request: Request, shift: unknown) {
  return (shift === '1' || shift === '2') && /\bGoogle-Apps-Script\b/i.test(request.headers.get('user-agent') || '');
}

export function readCardData<T>(kind: CardRead, date: string, shift: string, load: () => Promise<T>) {
  const tag = cardTag(date, shift);
  return unstable_cache(async () => {
    const data = await load();
    console.info('TELEGRAM_CARD_SOURCE_READ', kind, date, shift);
    return {data, loadedAt: Date.now()};
  }, [tag, kind], {tags: [tag], revalidate: 3600})();
}

export function invalidateCardData(date: string, shift: string) {
  try {
    revalidateTag(cardTag(date, shift), {expire: 0});
  } catch {
    // A committed production report must keep its successful receipt if cache infrastructure fails.
    console.warn('TELEGRAM_CARD_INVALIDATION_FAILED', date, shift);
  }
}
