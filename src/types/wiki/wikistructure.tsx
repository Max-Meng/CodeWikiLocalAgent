import { WikiPage } from "./wikipage";

export interface WikiSection {
  id: string;
  title: string;
  pages: string[];
  subsections?: string[];
}

export interface WikiStructure {
  id: string;
  title: string;
  description: string;
  pages: WikiPage[];
  sections: WikiSection[];
  rootSections: string[];
}

export interface WikiData {
  metadata: {
    source: string;
    generated_at: string;
    page_count: number;
    generator: string;
  };
  structure: WikiStructure;
}
