import { lazy, Suspense } from "react";

const ReactMarkdown = lazy(() => import("react-markdown"));

type LazyMarkdownProps = {
  children: string;
};

export function LazyMarkdown({ children }: LazyMarkdownProps) {
  return (
    <Suspense fallback={<span className="whitespace-pre-wrap">{children}</span>}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </Suspense>
  );
}
