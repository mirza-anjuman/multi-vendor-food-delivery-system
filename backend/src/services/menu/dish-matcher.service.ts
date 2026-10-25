/**
 * Dish Matcher Service — High-precision semantic matching for menu items.
 *
 * Implements canonical dish resolution and conservative matching:
 * - Precision over recall: A false match is unacceptable.
 * - Negative style/protein disqualification (e.g. Chicken Fry != Chicken Curry).
 * - Multi-language support (English transliteration & Bangla script).
 */

const BENGALI_TOKEN_MAP: Record<string, string> = {
  'ফুচকা': 'fuchka',
  'চটপটি': 'chotpoti',
  'সিঙ্গারা': 'shingara',
  'শিঙাড়া': 'shingara',
  'সমুচা': 'samosa',
  'খিচুড়ি': 'khichuri',
  'বিরিয়ানি': 'biryani',
  'বিরিয়ানি': 'biryani',
  'কাচ্চি': 'kacchi',
  'তেহারি': 'tehari',
  'পোলাও': 'polao',
  'চিকেন': 'chicken',
  'বিফ': 'beef',
  'মাটন': 'mutton',
  'বার্গার': 'burger',
  'পিজ্জা': 'pizza',
  'পিজা': 'pizza',
  'ফ্রাই': 'fry',
  'ফ্রাইড': 'fried',
  'ভুনা': 'bhuna',
  'রোস্ট': 'roast',
  'ডাল': 'daal',
  'আলু': 'aloo',
  'ভর্তা': 'bhorta',
  'বোরহানি': 'borhani',
  'নান': 'naan',
  'মোমো': 'momo',
  'নুডুলস': 'noodles',
  'চাউমিন': 'chowmein',
  'ফ্রাইস': 'fries',
  'স্যান্ডউইচ': 'sandwich',
  'কাবাব': 'kebab',
  'স্যুপ': 'soup',
  'সালাদ': 'salad',
};

const TRANSLITERATION_MAP: Record<string, string> = {
  'kachchi': 'kacchi',
  'kacci': 'kacchi',
  'kachi': 'kacchi',
  'chotpotti': 'chotpoti',
  'chatpati': 'chotpoti',
  'phuchka': 'fuchka',
  'puchka': 'fuchka',
  'golgappa': 'fuchka',
  'panipuri': 'fuchka',
  'singara': 'shingara',
  'vuna': 'bhuna',
  'teheri': 'tehari',
  'tahari': 'tehari',
  'pulao': 'polao',
  'pilau': 'polao',
  'khichri': 'khichuri',
  'burhani': 'borhani',
  'dal': 'daal',
  'nan': 'naan',
  'porota': 'paratha',
  'momos': 'momo',
  'chow mein': 'chowmein',
  'kabab': 'kebab',
  'kababs': 'kebab',
  'french fries': 'fries',
};

const STRIP_WORDS_REGEX =
  /\b(?:half|full|regular|large|small|medium|mini|quarter|1:1|1:2|1:3|1:4|combo|set\s+menu|set|deluxe|special|platter|plate|meal|portion|servings?|pcs?|pieces?|box|gm|kg|ml|ltr?)\b/gi;

export function normalizeDishName(rawName: string): string {
  if (!rawName) return '';
  let name = rawName;

  // 1. Remove parenthetical expressions
  name = name.replace(/\([^)]*\)/g, ' ');
  name = name.replace(/\[[^\]]*\]/g, ' ');

  // 2. Map Bangla script tokens
  for (const [bangla, latin] of Object.entries(BENGALI_TOKEN_MAP)) {
    if (name.includes(bangla)) {
      name = name.split(bangla).join(` ${latin} `);
    }
  }

  // 3. Lowercase and normalize common punctuation
  name = name.toLowerCase();
  name = name.replace(/['’`]/g, '');
  name = name.replace(/[&]/g, ' and ');
  name = name.replace(/[-_/\\+]/g, ' ');

  // 4. Remove quantities like "6pcs", "250ml"
  name = name.replace(/\b\d+\s*(?:pcs?|pieces?|box|gm|kg|ml|l|ltr|pack)\b/gi, ' ');

  // 5. Remove size / portion filler words
  name = name.replace(STRIP_WORDS_REGEX, ' ');

  // 6. Token level transliteration normalization
  const rawTokens = name.split(/\s+/).filter(Boolean);
  const normalizedTokens = rawTokens.map((token) => TRANSLITERATION_MAP[token] || token);

  let result = normalizedTokens.join(' ');
  for (const [phrase, replacement] of Object.entries(TRANSLITERATION_MAP)) {
    if (phrase.includes(' ') && result.includes(phrase)) {
      result = result.split(phrase).join(replacement);
    }
  }

  return result.replace(/\s+/g, ' ').trim();
}

/**
 * Mutually exclusive token buckets. Two dishes CANNOT match if they have
 * opposing tokens from any of these exclusive pairs.
 */
const EXCLUSIVE_STYLE_PAIRS: Array<[string[], string[]]> = [
  // Fry vs Curry / Gravy / Bhuna
  [['fry', 'fried', 'crispy', 'broast'], ['curry', 'bhuna', 'gravy', 'korma', 'roast', 'masala', 'jhol']],
  // Tehari vs Biryani vs Khichuri
  [['tehari'], ['biryani', 'kacchi', 'khichuri', 'polao']],
  [['kacchi'], ['tehari', 'khichuri', 'polao']],
  [['khichuri'], ['tehari', 'biryani', 'polao']],
  // Burger vs Sandwich vs Pizza vs Pasta
  [['burger'], ['pizza', 'sandwich', 'pasta', 'noodles', 'chowmein', 'roll', 'wrap']],
  [['pizza'], ['burger', 'sandwich', 'pasta', 'noodles', 'chowmein', 'roll', 'wrap']],
  [['sandwich'], ['burger', 'pizza', 'pasta', 'noodles', 'roll', 'wrap']],
  // Wings vs Nuggets vs Strips
  [['wings', 'wing'], ['nuggets', 'nugget', 'tenders', 'tender', 'strips']],
  [['nuggets', 'nugget'], ['wings', 'wing', 'tenders', 'tender', 'strips']],
  // Soup vs Salad
  [['soup'], ['salad']],
];

const PROTEIN_TOKENS = ['beef', 'chicken', 'mutton', 'prawn', 'shrimp', 'fish', 'egg', 'paneer', 'vegetable', 'veg', 'mushroom'];

/**
 * Returns true if two food items represent the same dish with high confidence.
 */
export function isSameDish(
  nameA: string,
  nameB: string,
  options?: { categoryA?: string; categoryB?: string }
): boolean {
  if (!nameA || !nameB) return false;

  const normA = normalizeDishName(nameA);
  const normB = normalizeDishName(nameB);

  if (normA === normB) return true;

  const tokensA = new Set(normA.split(/\s+/).filter(Boolean));
  const tokensB = new Set(normB.split(/\s+/).filter(Boolean));

  // 1. Check for mutually exclusive style violations
  for (const [group1, group2] of EXCLUSIVE_STYLE_PAIRS) {
    const aHas1 = group1.some((t) => tokensA.has(t));
    const bHas1 = group1.some((t) => tokensB.has(t));
    const aHas2 = group2.some((t) => tokensA.has(t));
    const bHas2 = group2.some((t) => tokensB.has(t));

    if ((aHas1 && bHas2) || (aHas2 && bHas1)) {
      return false; // Disqualified! (e.g. Chicken fry vs Chicken curry)
    }
  }

  // 2. Check for protein mismatch (e.g. Beef Burger vs Chicken Burger)
  const proteinsInA = PROTEIN_TOKENS.filter((p) => tokensA.has(p));
  const proteinsInB = PROTEIN_TOKENS.filter((p) => tokensB.has(p));

  if (proteinsInA.length > 0 && proteinsInB.length > 0) {
    const hasCommonProtein = proteinsInA.some((p) => proteinsInB.includes(p));
    if (!hasCommonProtein) {
      return false; // Different primary protein!
    }
  }

  // 3. Core dish noun check
  const dishTypes = [
    'burger', 'sandwich', 'pizza', 'pasta', 'noodles', 'chowmein',
    'biryani', 'tehari', 'kacchi', 'khichuri', 'polao',
    'wings', 'nuggets', 'fries', 'fuchka', 'chotpoti', 'shingara', 'samosa',
    'soup', 'salad', 'naan', 'paratha', 'kebab', 'momo', 'waffle', 'pancake'
  ];

  const typeInA = dishTypes.filter((t) => tokensA.has(t));
  const typeInB = dishTypes.filter((t) => tokensB.has(t));

  if (typeInA.length > 0 && typeInB.length > 0) {
    const hasCommonType = typeInA.some((t) => typeInB.includes(t));
    if (!hasCommonType) {
      return false; // Different dish type
    }
  }

  // 4. Jaccard token similarity with conservative threshold
  let intersectionCount = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersectionCount++;
  }
  const unionCount = new Set([...tokensA, ...tokensB]).size;
  const jaccard = unionCount > 0 ? intersectionCount / unionCount : 0;

  // Strict threshold: at least 0.6 token similarity AND at least 2 common tokens
  // or exact subset when core words match
  if (jaccard >= 0.6 && intersectionCount >= 2) {
    return true;
  }

  // If one is a strict subset of the other and includes the primary type and protein
  const smaller = tokensA.size <= tokensB.size ? tokensA : tokensB;
  const larger = tokensA.size <= tokensB.size ? tokensB : tokensA;

  let allSmallerInLarger = true;
  for (const t of smaller) {
    if (!larger.has(t) && !['classic', 'special', 'delight', 'crispy'].includes(t)) {
      allSmallerInLarger = false;
      break;
    }
  }

  if (allSmallerInLarger && smaller.size >= 2) {
    return true;
  }

  return false;
}
