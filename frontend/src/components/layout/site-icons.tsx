import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return <IconBase {...props}><path d="M4 7h16M4 12h16M4 17h16" /></IconBase>;
}

export function CartIcon(props: IconProps) {
  return <IconBase {...props}><path d="M3 4h2l2.4 10.5a1 1 0 0 0 1 .8h10a1 1 0 0 0 1-.8L21 8H6" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></IconBase>;
}

export function CloseIcon(props: IconProps) {
  return <IconBase {...props}><path d="m6 6 12 12M18 6 6 18" /></IconBase>;
}

export function SunIcon(props: IconProps) {
  return <IconBase {...props}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></IconBase>;
}

export function MoonIcon(props: IconProps) {
  return <IconBase {...props}><path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z" /></IconBase>;
}

export function ChevronDownIcon(props: IconProps) {
  return <IconBase {...props}><path d="m7 10 5 5 5-5" /></IconBase>;
}

export function CalendarIcon(props: IconProps) {
  return <IconBase {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></IconBase>;
}

export function SearchIcon(props: IconProps) {
  return <IconBase {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></IconBase>;
}

export function ChatIcon(props: IconProps) {
  return <IconBase {...props}><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 9 9 0 0 1-3-.6L4 20l1.4-4A7.5 7.5 0 1 1 20 11.5Z" /><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" /></IconBase>;
}

export function ClipboardIcon(props: IconProps) {
  return <IconBase {...props}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M8.5 9h7M8.5 13h7M8.5 17h4" /></IconBase>;
}

export function UsersIcon(props: IconProps) {
  return <IconBase {...props}><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20M16 5.5a3 3 0 0 1 0 5.8M19 20v-1.5a5.5 5.5 0 0 0-2.8-4.8" /></IconBase>;
}

export function GridIcon(props: IconProps) {
  return <IconBase {...props}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></IconBase>;
}

export function DatabaseIcon(props: IconProps) {
  return <IconBase {...props}><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" /></IconBase>;
}

export function HelpCircleIcon(props: IconProps) {
  return <IconBase {...props}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.7 2.7 0 1 1 4.6 2c-1.1 1-2.1 1.5-2.1 3M12 17h.01" /></IconBase>;
}

export function TagIcon(props: IconProps) {
  return <IconBase {...props}><path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Z" /><circle cx="8" cy="8" r="1" /></IconBase>;
}

export function CreditCardIcon(props: IconProps) {
  return <IconBase {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></IconBase>;
}

export function SettingsIcon(props: IconProps) {
  return <IconBase {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.2 2.2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3.2v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.2-2.2.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H5v-3.2h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.2-2.2.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3.5h3.2v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.2 2.2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V13h-.2a1.7 1.7 0 0 0-1.5 1Z" /></IconBase>;
}

export function ArrowLeftIcon(props: IconProps) {
  return <IconBase {...props}><path d="m15 18-6-6 6-6" /></IconBase>;
}

export function PlaneIcon(props: IconProps) {
  return <IconBase {...props}><path d="m21 16-8-3v6l-2 1-2-8-6-3V7l6 1 2-7 2 1v7l8 3v4Z" /></IconBase>;
}

export function SuitcaseIcon(props: IconProps) {
  return <IconBase {...props}><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M4 12h16M8 10v4M16 10v4" /></IconBase>;
}

export function HotelIcon(props: IconProps) {
  return <IconBase {...props}><path d="M4 20V5h10v15M14 10h6v10M7 9h1M10 9h1M7 13h1M10 13h1M2 20h20" /></IconBase>;
}

export function BusIcon(props: IconProps) {
  return <IconBase {...props}><rect x="5" y="3" width="14" height="16" rx="3" /><path d="M5 11h14M8 7h8M8 19v2M16 19v2" /><circle cx="8" cy="15" r="1" /><circle cx="16" cy="15" r="1" /></IconBase>;
}

export function TrainIcon(props: IconProps) {
  return <IconBase {...props}><rect x="6" y="2" width="12" height="17" rx="4" /><path d="M6 11h12M9 6h6M8 22l3-3M16 22l-3-3" /><circle cx="9" cy="15" r="1" /><circle cx="15" cy="15" r="1" /></IconBase>;
}

export function ShieldIcon(props: IconProps) {
  return <IconBase {...props}><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></IconBase>;
}

export function BookIcon(props: IconProps) {
  return <IconBase {...props}><path d="M4 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4V4ZM20 4h-4a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h4V4Z" /></IconBase>;
}

export function CompassIcon(props: IconProps) {
  return <IconBase {...props}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z" /></IconBase>;
}

export function MapRouteIcon(props: IconProps) {
  return <IconBase {...props}><path d="m3 6 5-2 8 3 5-2v13l-5 2-8-3-5 2V6Z" /><path d="M8 4v13M16 7v13" /></IconBase>;
}

export function BedIcon(props: IconProps) {
  return <IconBase {...props}><path d="M3 19V8M21 19v-6a3 3 0 0 0-3-3H8a3 3 0 0 0-3 3v3h16M5 10V7h5a3 3 0 0 1 3 3M3 16h18" /></IconBase>;
}

export function FlightTicketIcon(props: IconProps) {
  return <IconBase {...props}><path d="M4 6h16a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8a2 2 0 0 1 2-2Z" /><path d="m16 14-4-1.5V15l-1 .5-1-3.5-3-1.5v-1l3 .5 1-3 1 .5v3l4 1.5v2Z" /></IconBase>;
}

export function PlaneTakeoffIcon(props: IconProps) {
  return <IconBase {...props}><path d="m3 17 7.5-2.7 3.8 4.2 1.8-.7-1.2-5.2 4.8-1.8c1.1-.4 1.7-1.6 1.3-2.7-.4-1.1-1.6-1.7-2.7-1.3l-4.8 1.8-4.2-3.3-1.8.7 2.1 5.3L2 14.1" /><path d="M3 21h18" /></IconBase>;
}
export function PassportIcon(props: IconProps) {
  return <IconBase {...props}><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="12" cy="11" r="3" /><path d="M9 11h6M12 8v6M9 17h6" /></IconBase>;
}

export function RoadBusIcon(props: IconProps) {
  return <IconBase {...props}><path d="M3 7h14.5A3.5 3.5 0 0 1 21 10.5V17H3Z" /><path d="M5 10h4v4H5zm6 0h4v4h-4zm6 0h2.5M3 17h18" /><circle cx="7" cy="19" r="2" /><circle cx="17" cy="19" r="2" /></IconBase>;
}

export function RailwayIcon(props: IconProps) {
  return <IconBase {...props}><path d="M8 3h8l2 3v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6Z" /><path d="M6 9h12M9 6h6M8 22l4-4 4 4M7 22h10" /><circle cx="9" cy="14" r="1" /><circle cx="15" cy="14" r="1" /></IconBase>;
}

export function PhoneIcon(props: IconProps) {
  return <IconBase {...props}><path d="M7.2 3.5 9.5 8l-2.1 1.7a15 15 0 0 0 6.9 6.9l1.7-2.1 4.5 2.3v2.7c0 .8-.7 1.5-1.5 1.5A16 16 0 0 1 3 5c0-.8.7-1.5 1.5-1.5h2.7Z" /></IconBase>;
}

export function MailIcon(props: IconProps) {
  return <IconBase {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></IconBase>;
}

export function ClockIcon(props: IconProps) {
  return <IconBase {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></IconBase>;
}

export function LocationIcon(props: IconProps) {
  return <IconBase {...props}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></IconBase>;
}

export function LinkedinIcon(props: IconProps) {
  return <IconBase {...props}><path d="M7 9v9M7 6v.1M11 18v-5a4 4 0 0 1 8 0v5M11 9v9" /></IconBase>;
}

export function TelegramIcon(props: IconProps) {
  return <IconBase {...props}><path d="m3 11 18-7-7 17-3.5-6.5L3 11Z" /><path d="m10.5 14.5 4-4" /></IconBase>;
}

export function InstagramIcon(props: IconProps) {
  return <IconBase {...props}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></IconBase>;
}

export function WhatsappIcon(props: IconProps) {
  return <IconBase {...props}><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z" /><path d="M9 8.5c.5 2.5 2 4 4.5 5" /></IconBase>;
}