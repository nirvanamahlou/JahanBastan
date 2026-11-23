export type NavigationItem = {
  label: string;
  href: string;
  children?: ReadonlyArray<{ label: string; href: string }>;
};

export const siteConfig = {
  name: "جهان باستان",
  description: "تور و خدمات سفر",
  phoneDisplay: "",
  phoneHref: "",
  address:
    "",
  businessHours: "شنبه تا چهارشنبه، ۹ تا ۱۹",
  contactHref: "/contact/",
  accountHref: "/account/",
  navigation: [
    { label: "خانه", href: "/" },
    { label: "مقاصد", href: "/destinations/" },
    { label: "مجله", href: "/articles/" },
    {
      label: "درباره ما",
      href: "/about/",
      children: [
        { label: "درباره جهان باستان", href: "/about/" },
        { label: "سوالات متداول", href: "/faq/" },
        { label: "تماس با ما", href: "/contact/" },
      ],
    },
    { label: "پرداخت آنلاین", href: "/payment/", children: [
      { label: "پرداخت آنلاین", href: "/payment/" },
      { label: "قوانین پرداخت و استرداد", href: "/payment-rules/" },
    ] },
  ] satisfies ReadonlyArray<NavigationItem>,
  footerLinks: [
    { label: "تورهای گردشگری", href: "/tours/" },
    { label: "مقاصد", href: "/destinations/" },
    { label: "هتل‌ها", href: "/hotels/" },
    { label: "مجله گردشگری", href: "/articles/" },
    { label: "درباره ما", href: "/about/" },
    { label: "سوالات متداول", href: "/faq/" },
    { label: "تماس با ما", href: "/contact/" },
    { label: "خرید اقساطی", href: "/installments/" },
    { label: "پرداخت آنلاین", href: "/payment/" },
  ],
  socialLinks: [
    {
      label: "لینکدین جهان باستان",
      href: "https://www.linkedin.com/company/jahanbastan",
      icon: "linkedin",
    },
    {
      label: "تلگرام جهان باستان",
      href: "https://t.me/jahanbastan",
      icon: "telegram",
    },
    {
      label: "اینستاگرام جهان باستان",
      href: "https://www.instagram.com/jahanbastan/",
      icon: "instagram",
    },
    {
      label: "واتساپ جهان باستان",
      href: "https://wa.me/982172075000",
      icon: "whatsapp",
    },
  ] as const,
} as const;
