import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./Layout";
import { PagePlaceholder } from "@/components/PagePlaceholder";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { SalesPage } from "@/features/sales/SalesPage";
import { CreditSalesPage } from "@/features/credit/CreditSalesPage";
import { DebtsPage } from "@/features/credit/DebtsPage";
import { HistoryPage } from "@/features/history/HistoryPage";
import { PurchasePage } from "@/features/purchasing/PurchasePage";
import { ProductsPage } from "@/features/items/ProductsPage";
import { CustomersPage } from "@/features/customers/CustomersPage";
import { SuppliersPage } from "@/features/suppliers/SuppliersPage";
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
export const router = createBrowserRouter([
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
        element: (
          <PagePlaceholder
            title="Cek Harga"
            fase="Fase 6"
            desc="Lookup cepat: nama, harga beli, harga jual, margin, stok, dan riwayat pembelian."
          />
        ),
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
        element: guard(
          <PagePlaceholder
            title="Laporan"
            fase="Fase 6"
            desc="Penjualan, laba/rugi, arus kas, dan ekspor CSV/PDF."
          />,
          PEMILIK,
        ),
      },
      {
        path: "pengaturan",
        element: guard(
          <PagePlaceholder
            title="Pengaturan"
            fase="Fase 8"
            desc="Profil toko, format struk, opsi stok & harga, backup/restore."
          />,
          PEMILIK,
        ),
      },
    ],
  },
]);
