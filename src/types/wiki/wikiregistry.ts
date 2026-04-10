export interface WikiProject {
  /** Unique identifier (used in URL: /wiki/{id}) */
  id: string;
  /** Display name (e.g., "Snappy", "DsMainDev") */
  name: string;
  /** Owner or organization */
  owner: string;
  /** Repository or source path */
  repository: string;
  /** Short description */
  description: string;
  /** Tags for filtering/display */
  tags: string[];
  /** Number of wiki pages */
  pageCount: number;
  /** When the wiki was generated */
  generatedAt: string;
  /** Filename in /wikis/ folder */
  dataFile: string;
}

export interface WikiRegistry {
  projects: WikiProject[];
}
