export type NavigationItem = {
  label: string;
  href: string;
  children?: ReadonlyArray<{ label: string; href: string }>;
};

const aboutContactLink = { label: "درباره و تماس", href: "/contact/" } as const;

const navigation: readonly NavigationItem[] = [
  { label: "خانه", href: "/" },
  { label: "مقاصد", href: "/destinations/" },
  { label: "مجله", href: "/articles/" },
  aboutContactLink,
];

export const siteConfig = {
  aboutContactLink,
  name: "جهان باستان",
  description: "تور و خدمات سفر",
  phoneDisplay: "",
  phoneHref: "",
  address:
    "",
  businessHours: "شنبه تا چهارشنبه، ۹ تا ۱۹",
  contactHref: aboutContactLink.href,
  accountHref: "/account/",
  navigation,
  // These numbers match the saved footerQuick settings.
  footerLinks: [
    { settingsSlot: 1, label: "تورهای گردشگری", href: "/tours/" },
    { settingsSlot: 2, label: "مقاصد", href: "/destinations/" },
    { settingsSlot: 3, label: "هتل‌ها", href: "/hotels/" },
    { settingsSlot: 4, label: "مجله گردشگری", href: "/articles/" },
    { settingsSlot: 5, ...aboutContactLink },
    { settingsSlot: 8, label: "خرید اقساطی", href: "/installments/" },
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
