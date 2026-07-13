import {
  ShoppingCart,
  CreditCard,
  Package,
  Users,
  Truck,
  Wallet,
  Search,
  BarChart3,
  History,
  ShoppingBag,
  Settings,
  FileSpreadsheet,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/db/types";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Peran yang boleh melihat menu ini. */
  roles: Role[];
}

/** Menu utama. Kasir hanya melihat sebagian (transaksi, cek harga). */
export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Jual Tunai", icon: ShoppingCart, roles: ["pemilik", "kasir"] },
  { to: "/piutang", label: "Jual Piutang", icon: CreditCard, roles: ["pemilik", "kasir"] },
  { to: "/cek-harga", label: "Cek Harga", icon: Search, roles: ["pemilik", "kasir"] },
  { to: "/riwayat", label: "Riwayat", icon: History, roles: ["pemilik", "kasir"] },
  { to: "/produk", label: "Produk", icon: Package, roles: ["pemilik"] },
  { to: "/import-produk", label: "Import Produk", icon: FileSpreadsheet, roles: ["pemilik"] },
  { to: "/customer", label: "Customer", icon: Users, roles: ["pemilik", "kasir"] },
  { to: "/supplier", label: "Supplier", icon: Truck, roles: ["pemilik"] },
  { to: "/pembelian", label: "Pembelian", icon: ShoppingBag, roles: ["pemilik"] },
  { to: "/hutang-piutang", label: "Hutang & Piutang", icon: Wallet, roles: ["pemilik"] },
  { to: "/laporan", label: "Laporan", icon: BarChart3, roles: ["pemilik"] },
  { to: "/pengaturan", label: "Pengaturan", icon: Settings, roles: ["pemilik"] },
];
