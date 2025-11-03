import React from "react";
import { LegalMarkdown } from "../components/LegalLinks";

const SURVEY_DOC_PATH = "/docs/survey.md";

export default function Survey() {
  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="markdown-content space-y-6">
          <LegalMarkdown file={SURVEY_DOC_PATH} />
        </div>
      </div>
    </div>
  );
}
