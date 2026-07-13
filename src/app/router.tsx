import { createBrowserRouter } from "react-router-dom";

/** Base path untuk GitHub Pages (/pos-sjb/) atau dev (/). */
const BASENAME = import.meta.env.BASE_URL?.replace(/\/$/,"") ?? "";
import { Layout } from "./Layout";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { SalesPage } from "@/features/sales/SalesPage";
import { CreditSalesPage } from "@/features/credit/CreditSalesPage";
import { DebtsPage } from "@/features/credit/DebtsPage";
import { HistoryPage } from "@/features/history/HistoryPage";
import { PurchasePage } from "@/features/purchasing/PurchasePage";
import { ProductsPage } from "@/features/items/ProductsPage";
import { CustomersPage } from "@/features/customers/CustomersPage";
import { SuppliersPage } from "@/features/suppliers/SuppliersPage";
import { CekHargaPage } from "@/features/items/CekHargaPage";
import { ImportPage } from "@/features/items/ImportPage";
import { LaporanPage } from "@/features/reports/LaporanPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import type { Role } from "@/db/types";

const PEMILIK: Role[] = ["pemilik"];

/** Bungkus elemen dengan guard peran (opsional). */
function guard(node: React.ReactNode, roles?: Role[]) {
  return <RequireAuth roles={roles}>{node}</RequireAuth>;
}

/**
 * Router. Seluruh Layout berada di balik login (RequireAuth di Layout-wrapper),
 * dan route khusus Pemilik ditambah guard peran.
 */
export const router = createBrowserRouter(
  [
  {
    path: "/",
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <SalesPage />,
      },
      {
        path: "piutang",
        element: <CreditSalesPage />,
      },
      {
        path: "cek-harga",
        element: <CekHargaPage />,
      },
      {
        path: "riwayat",
        element: <HistoryPage />,
      },
      {
        path: "produk",
        element: guard(<ProductsPage />, PEMILIK),
      },
      {
        path: "import-produk",
        element: guard(<ImportPage />, PEMILIK),
      },
      {
        path: "customer",
        element: <CustomersPage />,
      },
      {
        path: "supplier",
        element: guard(<SuppliersPage />, PEMILIK),
      },
      {
        path: "pembelian",
        element: guard(<PurchasePage />, PEMILIK),
      },
      {
        path: "hutang-piutang",
        element: guard(<DebtsPage />, PEMILIK),
      },
      {
        path: "laporan",
        element: guard(<LaporanPage />, PEMILIK),
      },
      {
        path: "pengaturan",
        element: guard(<SettingsPage />, PEMILIK),
      },
    ],
  },
],
  { basename: BASENAME },
);
