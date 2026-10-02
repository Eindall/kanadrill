import { DRAWING_ANSWERS, isReverseMode, type KanjiReadings, type ReviewMode } from './learning';
import { kanaToRomaji } from './kana';
import { isRomajiCorrect } from './romaji';

/** Ce qu'il faut savoir d'un élément pour corriger une réponse. */
export interface AnswerableItem {
  /** Le caractère (nécessaire au QCM inversé : la réponse est le caractère choisi). */
  character?: string;
  readings: readonly string[];
  meanings: readonly string[];
  /** Présent pour un kanji. */
  kanji?: KanjiReadings;
}

/** Minuscules, accents et espaces ramenés à une forme comparable (« Soleil » = « soleil »). */
export function normalizeMeaning(input: string): string {
  return input.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

const HAS_KANA = /[\u3040-\u30ff]/;

/** Une lecture saisie en romaji ou en kana (hiragana, katakana) correspond-elle à l'une des lectures acceptées ? */
export function isReadingCorrect(answer: string, readings: readonly string[]): boolean {
  return isRomajiCorrect(HAS_KANA.test(answer) ? kanaToRomaji(answer) : answer, readings);
}

/**
 * Une réponse est-elle juste ? Selon l'exercice : romaji de la lecture d'un kana (QCM, saisie), sens d'un kanji
 * (QCM), lecture d'un kanji (romaji ou kana), ou, au tracé, le verdict (proposé par la comparaison avec le modèle,
 * corrigeable par l'utilisateur). Partagée par l'API (qui note) et le front (retour immédiat).
 */
export function isAnswerCorrect(mode: ReviewMode, answer: string, item: AnswerableItem): boolean {
  switch (mode) {
    case 'drawing':
      return answer === DRAWING_ANSWERS.correct || answer === DRAWING_ANSWERS.fair;
    case 'meaning': {
      const given = normalizeMeaning(answer);
      return given !== '' && item.meanings.some((meaning) => normalizeMeaning(meaning) === given);
    }
    case 'reading':
      return isReadingCorrect(answer, item.readings);
    case 'reverse':
    case 'kanjiReverse':
      return item.character !== undefined && answer === item.character;
    default:
      return isRomajiCorrect(answer, item.readings);
  }
}

/**
 * Les premiers sens à afficher (KANJIDIC2 en donne parfois beaucoup, et de longs : « enfant, signe de la 1ère
 * branche terrestre, signe du Rat (zodiaque) »). Au plus `max` sens, tant que le total reste sous `maxLength`
 * caractères ; le premier est toujours gardé.
 */
export function displayMeanings(item: Pick<AnswerableItem, 'meanings'>, max = 3, maxLength = 40): string {
  const kept: string[] = [];
  for (const meaning of item.meanings.slice(0, max)) {
    if (kept.length > 0 && [...kept, meaning].join(', ').length > maxLength) break;
    kept.push(meaning);
  }
  return kept.join(', ');
}

/** Les lectures d'un kanji à afficher (on puis kun, en kana). */
export function displayReadings(kanji: KanjiReadings): string {
  return [...kanji.on, ...kanji.kun].join(', ');
}

/** La bonne réponse à afficher en cas d'erreur, selon l'exercice. */
export function expectedAnswer(mode: ReviewMode, item: AnswerableItem): string {
  if (isReverseMode(mode)) return item.character ?? '';
  if (mode === 'meaning') return displayMeanings(item);
  if (mode === 'reading') return item.kanji ? displayReadings(item.kanji) : (item.readings[0] ?? '');
  if (mode === 'drawing' && item.kanji) return displayMeanings(item);
  return item.readings[0] ?? '';
}
