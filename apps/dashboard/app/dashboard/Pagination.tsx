import Link from "next/link";
import styles from "./ui.module.css";
import { ChevronLeftIcon, ChevronRightIcon } from "../landing-icons";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
  extraParams?: Record<string, string>;
}

function pageHref(basePath: string, page: number, extraParams: Record<string, string>): string {
  const params = new URLSearchParams(extraParams);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function pageNumbers(current: number, total: number): (number | "ellipsis")[] {
  const pages: number[] = [];
  const add = (p: number) => {
    if (!pages.includes(p)) pages.push(p);
  };

  add(1);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p > 1 && p < total) add(p);
  }
  add(total);
  pages.sort((a, b) => a - b);

  const withEllipsis: (number | "ellipsis")[] = [];
  let previous = 0;
  for (const p of pages) {
    if (previous && p - previous > 1) withEllipsis.push("ellipsis");
    withEllipsis.push(p);
    previous = p;
  }
  return withEllipsis;
}

export default function Pagination({
  currentPage,
  totalPages,
  basePath,
  extraParams = {},
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <Link
        href={pageHref(basePath, currentPage - 1, extraParams)}
        className={`${styles.pageBtn} ${currentPage <= 1 ? styles.pageBtnDisabled : ""}`}
        aria-label="Previous page"
        aria-disabled={currentPage <= 1}
      >
        <ChevronLeftIcon size={14} />
      </Link>

      {pageNumbers(currentPage, totalPages).map((p, i) =>
        p === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className={styles.pageEllipsis}>
            …
          </span>
        ) : (
          <Link
            key={p}
            href={pageHref(basePath, p, extraParams)}
            className={`${styles.pageBtn} ${p === currentPage ? styles.pageBtnActive : ""}`}
            aria-current={p === currentPage ? "page" : undefined}
          >
            {p}
          </Link>
        )
      )}

      <Link
        href={pageHref(basePath, currentPage + 1, extraParams)}
        className={`${styles.pageBtn} ${currentPage >= totalPages ? styles.pageBtnDisabled : ""}`}
        aria-label="Next page"
        aria-disabled={currentPage >= totalPages}
      >
        <ChevronRightIcon size={14} />
      </Link>
    </nav>
  );
}
