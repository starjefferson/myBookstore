const BOOK_CATEGORIES = [
  "Fiction",
  "Non-fiction",
  "Business",
  "Children's Books",
  "Self-help / Motivational",
  "History / Politics",
  "Biography / Memoir",
  "Comics"
];

const CATEGORY_RULES = [
  {
    category: "Children's Books",
    pattern: /\b(children|childrens|kid|kids|juvenile|young readers|picture book|early reader|middle grade|teen|toddler|activity book|colouring|coloring)\b/i
  },
  {
    category: "Comics",
    pattern: /\b(comic|comics|manga|graphic novel|superhero|marvel|dc comics)\b/i
  },
  {
    category: "Business",
    pattern: /\b(business|entrepreneur|entrepreneurship|management|leadership|marketing|finance|investing|investment|economics|startup|start-up|sales|corporate|career|workplace|ceo|executive)\b/i
  },
  {
    category: "Self-help / Motivational",
    pattern: /\b(self[- ]help|personal development|motivat|success|habits|mindset|productivity|wellness|psychology|therapy|confidence|inspirational|spiritual|devotional|faith)\b/i
  },
  {
    category: "History / Politics",
    pattern: /\b(history|historical|politic|government|war|conflict|revolution|colonial|military|president|democracy|diplomacy|geopolitic|civil rights)\b/i
  },
  {
    category: "Biography / Memoir",
    pattern: /\b(biograph|memoir|autobiograph|diary|life of|my story|oral history|reminiscence)\b/i
  }
];

const normalizeCategory = (value) => {
  if (!value) return "";
  const normalized = value.toLowerCase().replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").trim();
  return BOOK_CATEGORIES.find((category) => category.toLowerCase() === normalized)
    || (normalized === "non fiction" ? "Non-fiction" : "");
};

const classifyBookCategory = (book = {}) => {
  const vendorCategory = normalizeCategory(book.category);
  if (vendorCategory) return vendorCategory;

  const searchableText = [book.title, book.author, book.description, ...(book.genres || [])]
    .filter(Boolean)
    .join(" ");
  const matchingRule = CATEGORY_RULES.find((rule) => rule.pattern.test(searchableText));
  return matchingRule?.category || "Fiction";
};

module.exports = { BOOK_CATEGORIES, classifyBookCategory, normalizeCategory };
