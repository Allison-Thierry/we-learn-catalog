export type SearchGroup = {
  concept: string;
  synonyms: string[];
};

export type SearchDocument<T> = {
  item: T;
  key: string;
  title: string;
  primary: string;
  secondary: string;
};

type NormalizedDocument<T> = SearchDocument<T> & {
  normalizedTitle: string;
  normalizedPrimary: string;
  normalizedSecondary: string;
  allText: string;
  words: string[];
};

export type SearchIndex<T> = {
  documents: Map<string, NormalizedDocument<T>>;
  termAlternatives: Map<string, string[]>;
  phrases: string[];
  vocabulary: string[];
};

const stopWords = new Set([
  "a", "an", "and", "for", "how", "in", "of", "on", "the", "to", "with",
  "au", "aux", "de", "des", "du", "et", "la", "le", "les", "pour", "un", "une",
]);

export function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function containsTerm(text: string, term: string) {
  return Boolean(term) && (` ${text} `).includes(` ${term} `);
}

function hasWordPrefix(words: string[], prefix: string) {
  return prefix.length >= 3 && words.some((word) => word.startsWith(prefix));
}

function editDistanceWithin(left: string, right: string, maximum: number) {
  if (Math.abs(left.length - right.length) > maximum) return maximum + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    let rowMinimum = current[0];
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      rowMinimum = Math.min(rowMinimum, current[j]);
    }
    if (rowMinimum > maximum) return maximum + 1;
    previous = current;
  }
  return previous[right.length];
}

function typoDistance(word: string) {
  if (word.length < 4 || /\d/.test(word)) return 0;
  return word.length >= 8 ? 2 : 1;
}

function closestUnambiguousWord(word: string, vocabulary: string[]) {
  const maximum = typoDistance(word);
  if (!maximum) return "";
  let best = "";
  let bestDistance = maximum + 1;
  let tied = false;
  for (const candidate of vocabulary) {
    if (candidate === word || Math.abs(candidate.length - word.length) > maximum) continue;
    const distance = editDistanceWithin(word, candidate, maximum);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
      tied = false;
    } else if (distance === bestDistance && distance <= maximum) {
      tied = true;
    }
  }
  return bestDistance <= maximum && !tied ? best : "";
}

export function createSearchIndex<T>(documents: SearchDocument<T>[], groups: SearchGroup[]): SearchIndex<T> {
  const normalizedDocuments = documents.map((document) => {
    const normalizedTitle = normalizeSearchText(document.title);
    const normalizedPrimary = normalizeSearchText(document.primary);
    const normalizedSecondary = normalizeSearchText(document.secondary);
    const allText = [normalizedTitle, normalizedPrimary, normalizedSecondary].filter(Boolean).join(" ");
    return {
      ...document,
      normalizedTitle,
      normalizedPrimary,
      normalizedSecondary,
      allText,
      words: [...new Set(allText.split(" ").filter(Boolean))],
    };
  });

  const alternatives = new Map<string, Set<string>>();
  for (const group of groups) {
    const terms = [...new Set([group.concept, ...group.synonyms].map(normalizeSearchText).filter(Boolean))];
    for (const term of terms) {
      if (!alternatives.has(term)) alternatives.set(term, new Set());
      for (const alternative of terms) alternatives.get(term)?.add(alternative);
    }
  }

  const corpusWords = normalizedDocuments.flatMap((document) => document.words);
  const synonymWords = [...alternatives.keys()].filter((term) => !term.includes(" "));
  const vocabulary = [...new Set([...corpusWords, ...synonymWords])]
    .filter((word) => word.length >= 4)
    .sort();
  const phrases = [...alternatives.keys()]
    .filter((term) => term.includes(" "))
    .sort((a, b) => b.split(" ").length - a.split(" ").length || b.length - a.length);

  return {
    documents: new Map(normalizedDocuments.map((document) => [document.key, document])),
    termAlternatives: new Map([...alternatives].map(([term, values]) => [term, [...values]])),
    phrases,
    vocabulary,
  };
}

type QueryClause = {
  original: string;
  alternatives: string[];
  corrected: boolean;
};

function queryClauses<T>(query: string, index: SearchIndex<T>) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  const tokens = normalized.split(" ");
  const clauses: QueryClause[] = [];

  for (let position = 0; position < tokens.length;) {
    let phrase = "";
    for (const candidate of index.phrases) {
      const candidateTokens = candidate.split(" ");
      if (candidateTokens.length <= tokens.length - position
        && tokens.slice(position, position + candidateTokens.length).join(" ") === candidate) {
        phrase = candidate;
        break;
      }
    }
    if (phrase) {
      clauses.push({ original: phrase, alternatives: index.termAlternatives.get(phrase) || [phrase], corrected: false });
      position += phrase.split(" ").length;
      continue;
    }

    const token = tokens[position];
    position += 1;
    if (stopWords.has(token)) continue;
    const knownAlternatives = index.termAlternatives.get(token);
    if (knownAlternatives) {
      clauses.push({ original: token, alternatives: knownAlternatives, corrected: false });
      continue;
    }
    if ([...index.documents.values()].some((document) => document.words.includes(token))) {
      clauses.push({ original: token, alternatives: [token], corrected: false });
      continue;
    }
    const correction = closestUnambiguousWord(token, index.vocabulary);
    clauses.push({
      original: correction || token,
      alternatives: correction ? index.termAlternatives.get(correction) || [correction] : [token],
      corrected: Boolean(correction),
    });
  }

  return clauses.length ? clauses : [{ original: normalized, alternatives: [normalized], corrected: false }];
}

function clauseScore<T>(document: NormalizedDocument<T>, clause: QueryClause) {
  let best = 0;
  for (const alternative of clause.alternatives) {
    const isOriginal = alternative === clause.original;
    if (containsTerm(document.normalizedTitle, alternative)) best = Math.max(best, isOriginal ? 28 : 20);
    else if (containsTerm(document.normalizedPrimary, alternative)) best = Math.max(best, isOriginal ? 18 : 12);
    else if (containsTerm(document.normalizedSecondary, alternative)) best = Math.max(best, isOriginal ? 10 : 7);
  }
  if (!best && !clause.corrected && !clause.original.includes(" ") && hasWordPrefix(document.words, clause.original)) {
    best = 5;
  }
  return clause.corrected && best ? Math.max(3, best - 3) : best;
}

export function smartSearch<T>(items: T[], query: string, index: SearchIndex<T>, keyFor: (item: T) => string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return items;
  const clauses = queryClauses(query, index);
  return items
    .map((item, originalIndex) => {
      const document = index.documents.get(keyFor(item));
      if (!document) return { item, originalIndex, score: 0, matches: false };
      const scores = clauses.map((clause) => clauseScore(document, clause));
      const matches = scores.every((score) => score > 0);
      const phraseBonus = containsTerm(document.normalizedTitle, normalizedQuery) ? 40
        : containsTerm(document.allText, normalizedQuery) ? 15 : 0;
      return { item, originalIndex, score: scores.reduce((sum, score) => sum + score, 0) + phraseBonus, matches };
    })
    .filter((result) => result.matches)
    .sort((left, right) => right.score - left.score || left.originalIndex - right.originalIndex)
    .map((result) => result.item);
}
