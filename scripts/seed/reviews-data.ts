// Sample reviews from the original store (SEED), shown as examples on each product page.
// `npm run seed` upserts them by sampleKey (`<slug>-<index>`), so re-running never duplicates them.
// Every Arabic string is copied exactly from original/index.html.

export interface SeedReview {
  /** Stable key `<productSlug>-<index in the original list>` (unique, sparse index in MongoDB). */
  sampleKey: string;
  productSlug: string;
  name: string;
  rating: number;
  text: string;
  /** Display label from the original, e.g. "قبل أسبوعين". */
  whenLabel: string;
  helpfulBase: number;
}

export const SEED_REVIEWS: readonly SeedReview[] = [
  { sampleKey: 'awal-0', productSlug: 'awal', name: 'سارة', rating: 5, text: 'ريحة التراب طالعة طبيعية مرة، وقعدت ساعات تفوح بالصالة.', whenLabel: 'قبل أسبوعين', helpfulBase: 4 },
  { sampleKey: 'awal-1', productSlug: 'awal', name: 'فهد', rating: 4, text: 'حلوة وهادية، بس تمنيت لو تفوح أكثر بالغرف الكبيرة.', whenLabel: 'قبل شهر', helpfulBase: 1 },
  { sampleKey: 'fajr-0', productSlug: 'fajr', name: 'نورة', rating: 5, text: 'تنعش البيت من أول ما تشتعل، ريحة بحر نظيفة.', whenLabel: 'قبل 10 أيام', helpfulBase: 3 },
  { sampleKey: 'fajr-1', productSlug: 'fajr', name: 'خالد', rating: 4, text: 'الليمون واضح بالبداية وبعدها تهدا. مناسبة للصباح.', whenLabel: 'قبل 3 أسابيع', helpfulBase: 2 },
  { sampleKey: 'suhail-0', productSlug: 'suhail', name: 'مريم', rating: 5, text: 'مثالية للسهرة، الهيل واللبان مضبوطين.', whenLabel: 'قبل أسبوع', helpfulBase: 5 },
  { sampleKey: 'suhail-1', productSlug: 'suhail', name: 'يوسف', rating: 4, text: 'ريحة عميقة، تناسب الليل أكثر من النهار.', whenLabel: 'قبل شهرين', helpfulBase: 2 },
  { sampleKey: 'dala-0', productSlug: 'dala', name: 'لولوة', rating: 5, text: 'تحسسني بمجلس الصباح، قهوة وهيل واضحين.', whenLabel: 'قبل 5 أيام', helpfulBase: 3 },
  { sampleKey: 'dala-1', productSlug: 'dala', name: 'بدر', rating: 3, text: 'حلوة بس الريحة خفيفة شوي بالمساحات الكبيرة.', whenLabel: 'قبل شهر', helpfulBase: 1 },
  { sampleKey: 'bar-0', productSlug: 'bar', name: 'هند', rating: 5, text: 'جلسة البر داخل البيت! الدخان والجمر طالعين حلوين.', whenLabel: 'قبل أسبوعين', helpfulBase: 6 },
  { sampleKey: 'bar-1', productSlug: 'bar', name: 'عبدالله', rating: 5, text: 'أقوى شمعة جربتها، تملأ الصالة.', whenLabel: 'قبل 3 أسابيع', helpfulBase: 4 },
  { sampleKey: 'ghubar-0', productSlug: 'ghubar', name: 'دانة', rating: 4, text: 'الزعفران يبان بالبداية وبعدها يدفى. ثبات مقبول.', whenLabel: 'قبل أسبوع', helpfulBase: 2 },
  { sampleKey: 'ghubar-1', productSlug: 'ghubar', name: 'ماجد', rating: 5, text: 'عطر مختلف، كل ما لبسته أحد سأل عنه.', whenLabel: 'قبل شهر', helpfulBase: 5 },
  { sampleKey: 'rutab-0', productSlug: 'rutab', name: 'ريم', rating: 5, text: 'حلو بدون ما يثقل، الهيل والرطب ماشيين مع بعض.', whenLabel: 'قبل 12 يوم', helpfulBase: 3 },
  { sampleKey: 'rutab-1', productSlug: 'rutab', name: 'سلمان', rating: 4, text: 'ريحة صيفية جميلة، تمنيت ثباتها أطول شوي.', whenLabel: 'قبل شهرين', helpfulBase: 1 },
  { sampleKey: 'shat-0', productSlug: 'shat', name: 'أمل', rating: 5, text: 'خفيف ومنعش، مثالي للمشي بعد المغرب.', whenLabel: 'قبل 4 أيام', helpfulBase: 2 },
  { sampleKey: 'shat-1', productSlug: 'shat', name: 'طلال', rating: 4, text: 'الليمون والريحان واضحين، يناسب الصيف.', whenLabel: 'قبل 3 أسابيع', helpfulBase: 1 },
  { sampleKey: 'werd-0', productSlug: 'werd', name: 'جود', rating: 5, text: 'ياسمين وورد ناعم، يناسب الدوام.', whenLabel: 'قبل أسبوعين', helpfulBase: 3 },
  { sampleKey: 'werd-1', productSlug: 'werd', name: 'عبير', rating: 4, text: 'ريحة لطيفة وهادية، ما تزعج أحد.', whenLabel: 'قبل شهر', helpfulBase: 2 },
  { sampleKey: 'jadda-0', productSlug: 'jadda', name: 'أم سعود', rating: 5, text: 'ريحة بخور أصيلة تذكرني ببيت أهلي.', whenLabel: 'قبل أسبوع', helpfulBase: 5 },
  { sampleKey: 'jadda-1', productSlug: 'jadda', name: 'ناصر', rating: 4, text: 'العود واضح والورد خفيف، دخانه كثيف شوي.', whenLabel: 'قبل شهر', helpfulBase: 2 },
  { sampleKey: 'ghaim-0', productSlug: 'ghaim', name: 'شيخة', rating: 5, text: 'هادي وعميق، ريحة غيم قبل المطر فعلًا.', whenLabel: 'قبل 10 أيام', helpfulBase: 4 },
  { sampleKey: 'ghaim-1', productSlug: 'ghaim', name: 'حمد', rating: 4, text: 'عود نظيف، يناسب الأمسيات.', whenLabel: 'قبل 5 أسابيع', helpfulBase: 1 },
  { sampleKey: 'jumaa-0', productSlug: 'jumaa', name: 'منى', rating: 4, text: 'بسيط وحلو، يخلي البيت ريحته حلوة يوم الجمعة.', whenLabel: 'قبل أسبوعين', helpfulBase: 2 },
  { sampleKey: 'jumaa-1', productSlug: 'jumaa', name: 'راشد', rating: 5, text: 'سعره ممتاز والريحة أصيلة.', whenLabel: 'قبل شهر', helpfulBase: 3 },
];
