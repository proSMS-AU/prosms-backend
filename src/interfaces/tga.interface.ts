import {
  ReleaseCurrencyEnum,
  SearchTrainingResultStatusEnum,
  UsageRecommendationStateEnum
} from "../constants/tga.constant";

export interface ITrainingSearchResult {
  code: string;
  nrtId: string | null;
  type: { id: string; name: string; sortOrder: number };
  status: { id: SearchTrainingResultStatusEnum; isCurrent: boolean; name: string; sortOrder: number };
  title: string;
  supersededBy: { isEquivalent: boolean; code: string; title: string }[];
  supersedes: { isEquivalent: boolean; code: string; title: string }[];
}

export interface IReleaseResult {
  id: string;
  currency: ReleaseCurrencyEnum;
  releaseDate: string;
  releaseNumber: string;
  packagingInformation: { core: number; elective: number; measure: string } | null;
  workPlacementHours: number | null;
}

export interface IUnitShortInfo {
  code: string;
  hasPreRequisites: boolean;
  isEssential: boolean;
  isEssentialLabel: string;
  links: {
    rel: string;
    href: string;
  }[];
  title: string;
  type: string;
  usageRecommendation: UsageRecommendationStateEnum;
  usageRecommendationLabel: string | null;
}

export interface IUnitSearchResult {
  type: { id: string };
  nrtId: string | null;
  code: string;
  title: string;
  status: { id: SearchTrainingResultStatusEnum; name: string; isCurrent: boolean; sortOrder: number };
  trainingPackage: {
    code: string | null;
    title: string | null;
  } | null;
}
