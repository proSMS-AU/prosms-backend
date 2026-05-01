/* eslint-disable */

import axios from "axios";
import { ReleaseCurrencyEnum, UsageRecommendationStateEnum } from "../constants/tga.constant";
import { IReleaseResult, ITrainingSearchResult, IUnitSearchResult, IUnitShortInfo } from "../interfaces/tga.interface";
import { AppError } from "../utils/appError";
import { httpStatus } from "../constants";

const tgaBaseUrl = "https://training.gov.au";
const apiVersion = "1.0";

const searchQualifications = async (searchText: string) => {
  try {
    const searchResponse = await axios.get(
      `${tgaBaseUrl}/api/search/training?searchText=${searchText}&api-version=${apiVersion}`
    );

    // console.log({ searchText, searchResponse });

    const formattedQualifications = await Promise.all(
      searchResponse.data.data.map(async (item: ITrainingSearchResult) => {
        if (item.type.id !== "qualification") {
          return null;
        }

        let supersededByFullComponent = item;
        while (!supersededByFullComponent.status.isCurrent && supersededByFullComponent.status.name === "Superseded") {
          const newQualification = await axios.get(
            `${tgaBaseUrl}/api/search/training?searchText=${supersededByFullComponent.supersededBy[0].code}&api-version=${apiVersion}`
          );
          supersededByFullComponent = newQualification.data.data[0];
        }

        return {
          code: supersededByFullComponent.code,
          title: supersededByFullComponent.title,
          type: supersededByFullComponent.type.id,
          nrtId: supersededByFullComponent?.nrtId ?? null,
          status: supersededByFullComponent?.status?.name,
          isCurrent: supersededByFullComponent?.status?.isCurrent,
          replaced:
            supersededByFullComponent.code !== item.code
              ? {
                  code: item.code,
                  title: item.title,
                  type: item.type.id,
                  nrtId: item?.nrtId ?? null
                }
              : null
        };
      })
    );

    return formattedQualifications;
  } catch (error) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "INTERNAL_SERVER_ERROR",
      "Server error occurred while searching qualifications"
    );
  }
};

const findQualificationReleaseInfoAndUnits = async (qualificationCode: string) => {
  try {
    const releaseInfo = await axios.get(
      `${tgaBaseUrl}/api/training/${qualificationCode}/releases?api-version=${apiVersion}`
    );
    const releaseData: IReleaseResult[] = releaseInfo.data
      .map((release: IReleaseResult) => {
        if (release.currency !== ReleaseCurrencyEnum.CURRENT) {
          return null;
        }
        return {
          code: qualificationCode,
          id: release.id,
          releaseDate: release.releaseDate,
          releaseNumber: release.releaseNumber,
          packagingInformation: release.packagingInformation
            ? {
                core: release.packagingInformation.core,
                elective: release.packagingInformation.elective,
                measure: release.packagingInformation.measure
              }
            : null,
          workPlacementHours: release.workPlacementHours ?? null
        };
      })
      .filter((item: IReleaseResult | null) => item !== null)
      .sort((a: IReleaseResult, b: IReleaseResult) => b.releaseDate.localeCompare(a.releaseDate));

    if (releaseData.length === 0) {
      return null;
    }

    const latestReleaseData = releaseData[0];
    const releaseNumber = latestReleaseData.releaseNumber;
    const releaseId = latestReleaseData.id;

    const qualificationSummaryRes = await axios.get(
      `${tgaBaseUrl}/api/releases/${releaseId}/training?api-version=${apiVersion}`
    );
    if (qualificationSummaryRes.status !== 200 || !qualificationSummaryRes.data) {
      throw new AppError(httpStatus.NOT_FOUND, "NOT_FOUND", "Qualification summary not found for the latest release");
    }
    const qualificationSummary = qualificationSummaryRes.data;

    const unitsInfo = await axios.get(
      `${tgaBaseUrl}/api/training/${qualificationCode}/releases/${releaseNumber}/unitgrid?api-version=${apiVersion}`
    );
    const formattedData: IUnitShortInfo[] = unitsInfo.data.filter(
      (unit: IUnitShortInfo) => unit.usageRecommendation === UsageRecommendationStateEnum.CURRENT
    );

    return {
      qualification: {
        code: qualificationSummary.code,
        status: qualificationSummary.status,
        title: qualificationSummary.title,
        type: qualificationSummary.type
      },
      latestReleaseInfo: latestReleaseData,
      unitsInfo: formattedData
    };
  } catch (error) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "INTERNAL_SERVER_ERROR",
      "Server error occurred while fetching qualification release info and units"
    );
  }
};

const searchUnit = async (searchText: string) => {
  try {
    const units = await axios.get(
      `${tgaBaseUrl}/api/search/training?searchText=${searchText}&api-version=${apiVersion}`
    );
    const filteredUnits = units.data.data
      .filter((unit: IUnitSearchResult) => unit.type.id === "unit")
      .map((unit: IUnitSearchResult) => ({
        code: unit.code,
        title: unit.title,
        type: unit.type.id,
        nrtId: unit?.nrtId ?? null,
        status: unit.status?.id,
        isCurrent: unit.status?.isCurrent,
        trainingPackageInfo: unit.trainingPackage ?? null
      }));
    return filteredUnits;
  } catch (error) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "INTERNAL_SERVER_ERROR",
      "Server error occurred while searching for units"
    );
  }
};

const findQualificationsAndUnitsOfOrganisation = async (organisationCode: string) => {
  try {
    const organisationRes = await axios.get(
      `${tgaBaseUrl}/api/organisation/${organisationCode}?api-version=${apiVersion}`
    );
    if (!organisationRes.data) {
      throw new AppError(httpStatus.NOT_FOUND, "NOT_FOUND", "Organisation not found with the provided code");
    }
    const organisation = organisationRes.data;

    const scopeRes = await axios.get(
      `${tgaBaseUrl}/api/organisation/${organisationCode}/scope?api-version=${apiVersion}`
    );
    const orgQualifications: { code: string; title: string; status: string }[] = scopeRes.data.value
      .filter(
        (item: { componentType: string; status: string }) =>
          item.componentType === "qualification" && item.status === "current"
      )
      .map((qualification: { code: string; title: string; status: string }) => ({
        code: qualification.code,
        title: qualification.title,
        status: qualification.status
      }));
    const orgUnits: { code: string; title: string; status: string }[] = scopeRes.data.value
      .filter(
        (item: { componentType: string; status: string }) => item.componentType === "unit" && item.status === "current"
      )
      .map((unit: { code: string; title: string; status: string }) => ({
        code: unit.code,
        title: unit.title,
        status: unit.status
      }));
    const unitsAttachedToQualifications = new Set<string>();
    const qualificationsWithDetails = await Promise.all(
      orgQualifications.map(async (qualification) => {
        const qualificationDetails = await findQualificationReleaseInfoAndUnits(qualification.code);

        // * we need to match the units from qualificationDetails with the units in the organisation's scope and take only units that are owned by the organisation
        const filteredUnits = qualificationDetails
          ? qualificationDetails.unitsInfo
              .filter((unit) => orgUnits.some((orgUnit) => orgUnit.code === unit.code))
              .map((unit) => ({
                ...unit,
                status:
                  orgUnits.find((orgUnit) => orgUnit.code === unit.code)?.status.toLowerCase() ??
                  unit.usageRecommendation.toLowerCase()
              }))
          : [];
        filteredUnits.forEach((unit) => unitsAttachedToQualifications.add(unit.code));
        return {
          ...qualification,
          numberOfUnits: filteredUnits.length,
          latestReleaseInfo: qualificationDetails ? qualificationDetails.latestReleaseInfo : null,
          units: filteredUnits
        };
      })
    );
    // * Now filter out the units that are not attached to any qualifications
    const notAttachedUnits = orgUnits
      .filter((unit) => !unitsAttachedToQualifications.has(unit.code))
      .map((unit) => ({
        ...unit,
        hasPreRequisites: false,
        isEssential: false,
        isEssentialLabel: "Elective",
        links: [],
        usageRecommendation: "current",
        usageRecommendationLabel: "Current"
      }));
    return {
      organisation: { code: organisation.code },
      totalQualifications: orgQualifications.length,
      totalUnits: orgUnits.length,
      totalUnitsNotAttachedToQualifications: notAttachedUnits.length,
      qualifications: qualificationsWithDetails,
      unitsNotAttachedToQualifications: notAttachedUnits
    };
  } catch (error) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "INTERNAL_SERVER_ERROR",
      "Server error occurred while fetching organisation's qualifications and units"
    );
  }
};

// const verifyABN = async (rtoId: string, ABN: string) => {
//   const response = await axios.get(`${tgaBaseUrl}/api/organisation/${rtoId}/legalname?api-version=${apiVersion}`);

//   if (response.status !== 200 || !response.data?.length) {
//     throw new AppError(httpStatus.NOT_FOUND, "NOT_FOUND", "ABN not found");
//   }

//   const records = response.data;

//   // Prefer active record first
//   const active = records.filter((item: any) => !item.endDate);
//   const source = active.length ? active : records;

//   const latestRecord = source.reduce((latest: any, current: any) =>
//     new Date(current.startDate) > new Date(latest.startDate) ? current : latest
//   );

//   // Critical validation: ABN must exist in latest record
//   const abnExists = latestRecord?.abns?.includes(ABN);

//   if (!abnExists) {
//     throw new AppError(httpStatus.NOT_FOUND, "INVALID_ABN", "ABN does not match the latest organisation record");
//   }

//   return latestRecord;
// };

const verifyABN = async (rtoId: string, ABN: string) => {
  try {
    const response = await axios.get(
      `${tgaBaseUrl}/api/organisation/${rtoId}/legalname?api-version=${apiVersion}`
    );

    if (!response.data?.length) {
      throw new AppError(httpStatus.NOT_FOUND, "NOT_FOUND", "ABN not found");
    }

    const records = response.data;

    const active = records.filter((item: any) => !item.endDate);
    const source = active.length ? active : records;

    const latestRecord = source.reduce((latest: any, current: any) =>
      new Date(current.startDate) > new Date(latest.startDate) ? current : latest
    );

    const abnExists = latestRecord?.abns?.includes(ABN);

    if (!abnExists) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        "INVALID_ABN",
        "ABN does not match the latest organisation record"
      );
    }

    return latestRecord;

  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new AppError(httpStatus.NOT_FOUND, "NOT_FOUND", "Organisation not found");
    }

    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "TGA_API_ERROR",
      error.message || "External API failed"
    );
  }
};

export const TGAService = {
  searchQualifications,
  findQualificationReleaseInfoAndUnits,
  searchUnit,
  findQualificationsAndUnitsOfOrganisation,
  verifyABN
};
