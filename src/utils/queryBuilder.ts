/* eslint-disable @typescript-eslint/no-explicit-any */

import { Query } from "mongoose";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export class QueryBuilder<T> {
  public modelQuery: Query<T[], T>;
  public readonly query: Record<string, any>;

  private filterConditions: any[] = [];
  baseFilter: import("mongoose").FilterQuery<unknown>;

  constructor(modelQuery: Query<T[], T>, query: Record<string, any>) {
    this.modelQuery = modelQuery;
    this.query = query;

    // Fully generic extraction of initial find() filters
    this.baseFilter = modelQuery.getFilter();
  }

  filter(): this {
    const excludeFields = ["search", "sort", "fields", "page", "limit"];
    const filterQuery = { ...this.query };

    excludeFields.forEach((field) => delete filterQuery[field]);

    if (Object.keys(filterQuery).length > 0) {
      this.modelQuery = this.modelQuery.find(filterQuery);
      this.filterConditions.push(filterQuery);
    }

    return this;
  }

  search(searchableFields: string[]): this {
    const search = this.query.search?.trim();

    if (!search || searchableFields.length === 0) return this;

    // If the search looks like email → exact match
    if (search.includes("@")) {
      const exactMatchConditions = searchableFields.map((field) => ({
        [field]: { $regex: `^${escapeRegex(search)}$`, $options: "i" }
      }));

      const exactMatchFilter = { $or: exactMatchConditions };

      this.modelQuery = this.modelQuery.find(exactMatchFilter);
      this.filterConditions.push(exactMatchFilter);

      return this;
    }

    // Otherwise → regex fuzzy match
    const regexCondition = {
      $or: searchableFields.map((field) => ({
        [field]: { $regex: search, $options: "i" }
      }))
    };

    this.modelQuery = this.modelQuery.find(regexCondition);
    this.filterConditions.push(regexCondition);

    return this;
  }

  sort(): this {
    const sort = this.query.sort || "-createdAt";
    this.modelQuery = this.modelQuery.sort(sort);
    return this;
  }

  // select(): this {
  //   const fields = this.query.fields?.split(",").join(" ");
  //   if (fields) {
  //     this.modelQuery = this.modelQuery.select(fields);
  //   }
  //   return this;
  // }
  select(fields?: string | string[] | Record<string, 1 | 0>): this {
    if (!fields) return this;

    if (Array.isArray(fields)) {
      this.modelQuery = this.modelQuery.select(fields.join(" "));
    } else {
      this.modelQuery = this.modelQuery.select(fields);
    }

    return this;
  }

  pagination(): this {
    const page = Number(this.query.page) || 1;
    const limit = Number(this.query.limit) || 10;
    const skip = (page - 1) * limit;

    this.modelQuery = this.modelQuery.skip(skip).limit(limit);
    return this;
  }

  populate(populate: string | string[]): this {
    if (Array.isArray(populate)) {
      populate.forEach((p) => (this.modelQuery = this.modelQuery.populate(p)));
    } else {
      this.modelQuery = this.modelQuery.populate(populate);
    }
    return this;
  }

  build() {
    return this.modelQuery;
  }

  async getMeta() {
    const page = Number(this.query.page) || 1;
    const limit = Number(this.query.limit) || 10;

    const countConditions =
      this.filterConditions.length > 0 ? { $and: [this.baseFilter, ...this.filterConditions] } : this.baseFilter;

    const total = await this.modelQuery.model.countDocuments(countConditions);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}
