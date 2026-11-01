import { useEffect } from "react";

export function useDocumentTitle(title) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) {
      document.title = `${title} · Data Dynamo`;
    } else {
      document.title = "Data Dynamo — AI Credit Scoring";
    }
    return () => {
      document.title = prevTitle;
    };
  }, [title]);
}
