import {
  Utensils,
  Car,
  Banknote,
  TrendingUp,
  Stethoscope,
  ShieldCheck,
  Home,
  Gift,
  User,
  Zap,
  Receipt,
  CreditCard,
  Users,
  Plane,
  Tag,
  Briefcase,
  Award,
  Percent,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  "food": Utensils,
  "transportation": Car,
  "emi (pl)": Banknote,
  "sip (investment)": TrendingUp,
  "medical": Stethoscope,
  "term insurance": ShieldCheck,
  "health insurance": ShieldCheck,
  "home": Home,
  "gifts": Gift,
  "personal": User,
  "utilities": Zap,
  "living expenses": Receipt,
  "credit card (cc)": CreditCard,
  "father": Users,
  "travel fund": Plane,
  "other (tax)": Receipt,
  "paycheck (salary)": Briefcase,
  "bonus": Award,
  "interest": Percent,
  "other": HelpCircle,
};

export function getCategoryIcon(categoryName: string): LucideIcon {
  return CATEGORY_ICON_MAP[categoryName.toLowerCase().trim()] || Tag;
}
