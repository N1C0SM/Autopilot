export type FeaturePriority = "p0" | "p1" | "p2";

export type FeatureComplexity = "s" | "m" | "l" | "xl";

export type FeatureStatus = "todo" | "doing" | "done";

export type VersionStage =
  | "planned"
  | "internal"
  | "beta1"
  | "beta2"
  | "rc"
  | "released";

export interface Feature {
  id: string;
  title: string;
  priority: FeaturePriority;
  complexity: FeatureComplexity;
  status: FeatureStatus;
  notes?: string;
  dependsOn?: string[];
}

export interface Version {
  id: string;
  number: string;
  name: string;
  focus: string;
  phase: number;
  stage: VersionStage;
  build: number;
  targetDate?: string;
  features: Feature[];
}

export interface Phase {
  num: number;
  name: string;
}

export interface Roadmap {
  id: string;
  name: string;
  description?: string;
  phases: Phase[];
  versions: Version[];
  resolved?: string[];
}
