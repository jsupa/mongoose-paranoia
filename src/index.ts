import type { Model, Query, QueryWithHelpers, UpdateWriteOpResult, HydratedDocument } from 'mongoose'
import { Schema } from 'mongoose'

/**
 * Query helpers for filtering active/deleted records
 */
export interface ParanoiaQueryHelpers<ResultType = any, DocType = any, THelpers = {}> {
  /**
   * Filter to only return active (not deleted) records
   */
  active(this: QueryWithHelpers<ResultType, DocType, THelpers>): QueryWithHelpers<ResultType, DocType, THelpers>

  /**
   * Filter to only return deleted records
   */
  deleted(this: QueryWithHelpers<ResultType, DocType, THelpers>): QueryWithHelpers<ResultType, DocType, THelpers>

  /**
   * Return all records (both active and deleted)
   */
  withDeleted(this: QueryWithHelpers<ResultType, DocType, THelpers>): QueryWithHelpers<ResultType, DocType, THelpers>
}

/**
 * Static methods added to the model by Paranoia plugin
 */
export interface ParanoiaStatics {
  /**
   * Restore soft-deleted documents matching the filter
   * @param filter - Query filter to find documents to restore
   */
  restore(filter: any): Promise<UpdateWriteOpResult>
}

/**
 * Enhanced Model interface with Paranoia plugin methods
 * Use this when defining your model type for full type safety
 *
 * @example
 * ```typescript
 * interface IUser {
 *   name: string;
 *   email: string;
 * }
 *
 * type UserDocument = SoftDeleteDocument<IUser>;
 * type UserModel = ParanoiaModel<UserDocument, ParanoiaQueryHelpers>;
 *
 * const userSchema = new Schema<UserDocument, UserModel, {}, ParanoiaQueryHelpers>({
 *   name: String,
 *   email: String
 * });
 *
 * userSchema.plugin(Paranoia);
 * const User = model<UserDocument, UserModel>('User', userSchema);
 * ```
 */
export interface ParanoiaModel<
  T,
  TQueryHelpers = {},
  TInstanceMethods = {},
  TVirtuals = {},
  THydratedDocumentType = HydratedDocument<T, TVirtuals & TInstanceMethods, TQueryHelpers>,
  TSchema = any,
> extends Model<T, TQueryHelpers, TInstanceMethods, TVirtuals, THydratedDocumentType, TSchema>, ParanoiaStatics {}

/**
 * Options for configuring the Paranoia plugin
 */
export type ParanoiaOptions = {
  /**
   * Enable deletedAt timestamp field
   * @default true
   */
  deletedAt?: boolean

  /**
   * Enable deletedBy field to track who deleted the record
   * @default false
   */
  deletedBy?: boolean

  /**
   * Type of the deletedBy field (e.g., 'ObjectId', 'String')
   * @default 'ObjectId'
   */
  deletedByType?: string

  /**
   * Configure how the plugin handles queries by default
   * - "Scope": Must explicitly use .active or .deleted query helpers
   * - "Default": Automatically filter deleted records on all queries (use .deleted to include them)
   * - "All": Return all records by default (use .active to filter)
   * @default "Default"
   */
  activeArchive?: 'Scope' | 'Default' | 'All'

  /**
   * Name of the deleted field
   * @default 'deleted'
   */
  deletedField?: string

  /**
   * Name of the deletedAt field
   * @default 'deletedAt'
   */
  deletedAtField?: string

  /**
   * Name of the deletedBy field
   * @default 'deletedBy'
   */
  deletedByField?: string
}

/**
 * Interface for documents with paranoia fields
 * Extend your document interface with this to include soft delete fields
 *
 * @example
 * ```typescript
 * interface IUser extends ParanoiaDocument {
 *   name: string;
 *   email: string;
 * }
 * ```
 */
export interface ParanoiaDocument {
  /**
   * Indicates if the document is soft-deleted
   */
  deleted: boolean

  /**
   * Timestamp when the document was deleted
   */
  deletedAt?: Date

  /**
   * Reference to who deleted the document (if deletedBy is enabled)
   */
  deletedBy?: any

  /**
   * Restore a soft-deleted document
   */
  restore(): Promise<this>
}

/**
 * Type helper for creating a fully-typed Paranoia document
 * Combines your document interface with ParanoiaDocument
 *
 * @example
 * ```typescript
 * interface IUser {
 *   name: string;
 *   email: string;
 * }
 *
 * type UserDocument = SoftDeleteDocument<IUser>;
 * ```
 */
export type SoftDeleteDocument<T> = T & ParanoiaDocument

export default function Paranoia<
  DocType = any,
  TQueryHelpers = {},
>(
  schema: Schema<DocType, any, any, TQueryHelpers & ParanoiaQueryHelpers>,
  options: ParanoiaOptions = {},
) {
  // Set default options
  const opts = {
    deletedAt: true,
    deletedBy: false,
    deletedByType: 'ObjectId',
    activeArchive: 'Default' as const,
    deletedField: 'deleted',
    deletedAtField: 'deletedAt',
    deletedByField: 'deletedBy',
    ...options,
  }

  // Add the 'deleted' field (always required)
  schema.add({
    [opts.deletedField]: {
      type: Boolean,
      default: false,
      index: true,
    },
  } as any)

  // Add 'deletedAt' field if enabled
  if (opts.deletedAt) {
    schema.add({
      [opts.deletedAtField]: {
        type: Date,
        default: null,
      },
    } as any)
  }

  // Add 'deletedBy' field if enabled
  if (opts.deletedBy) {
    const deletedByFieldType =
      opts.deletedByType === 'ObjectId' ? { type: Schema.Types.ObjectId, ref: 'User' } : { type: String }

    schema.add({
      [opts.deletedByField]: {
        ...deletedByFieldType,
        default: null,
      },
    } as any)
  }

  // Override Model static methods to perform soft delete instead of hard delete
  schema.statics.deleteOne = async function (filter: any, options?: any) {
    const update = {
      [opts.deletedField]: true,
      ...(opts.deletedAt && { [opts.deletedAtField]: new Date() }),
    }
    return this.updateOne(filter, { $set: update } as any, options)
  }

  schema.statics.deleteMany = async function (filter: any, options?: any) {
    const update = {
      [opts.deletedField]: true,
      ...(opts.deletedAt && { [opts.deletedAtField]: new Date() }),
    }
    return this.updateMany(filter, { $set: update } as any, options)
  }

  schema.statics.findOneAndDelete = async function (filter: any, options?: any) {
    const update = {
      [opts.deletedField]: true,
      ...(opts.deletedAt && { [opts.deletedAtField]: new Date() }),
    }
    return this.findOneAndUpdate(filter, { $set: update } as any, { ...options, new: false })
  }

  schema.statics.findByIdAndDelete = async function (id: any, options?: any) {
    const update = {
      [opts.deletedField]: true,
      ...(opts.deletedAt && { [opts.deletedAtField]: new Date() }),
    }
    return this.findByIdAndUpdate(id, { $set: update } as any, { ...options, new: false })
  }

  // Add query helpers for scopes
  schema.query = {
    ...schema.query,
    /**
     * Filter to only return active (not deleted) records
     */
    active(this: Query<any, any>) {
      if (!opts.deletedField) {
        throw new Error('deletedField is required for active query helper')
      }
      return this.where({ [opts.deletedField]: { $ne: true } })
    },

    /**
     * Filter to only return deleted records
     */
    deleted(this: Query<any, any>) {
      if (!opts.deletedField) {
        throw new Error('deletedField is required for deleted query helper')
      }
      return this.where({ [opts.deletedField]: true })
    },

    /**
     * Return all records (both active and deleted) - bypasses default filtering
     */
    withDeleted(this: Query<any, any>) {
      // Mark that we want to include deleted records
      ;(this as any)._includeDeleted = true
      return this
    },
  }

  // Add default filtering based on activeArchive option
  if (opts.activeArchive === 'Default') {
    // Automatically filter out deleted records on all find queries
    const queryMiddleware = function (this: any) {
      // Skip if explicitly wanting deleted or all records
      if (this._includeDeleted) {
        return
      }

      // Ensure deletedField exists
      if (!opts.deletedField) {
        return
      }

      // Add deleted: {$ne: true} to include documents without the field (backwards compatibility)
      const filter = this.getFilter()
      if (filter[opts.deletedField] === undefined) {
        this.where({ [opts.deletedField]: { $ne: true } })
      }
    }

    schema.pre('find', queryMiddleware)
    schema.pre('findOne', queryMiddleware)
    schema.pre('findOneAndUpdate', queryMiddleware)
    schema.pre('countDocuments', queryMiddleware)
  }

  // Add aggregate middleware to filter deleted records
  if (opts.activeArchive === 'Default') {
    schema.pre('aggregate', function (this: any) {
      // Skip if explicitly wanting all records
      if (this._includeDeleted) {
        return
      }

      // Ensure deletedField exists
      if (!opts.deletedField) {
        return
      }

      // Add $match stage at the beginning to filter deleted records
      const pipeline = this.pipeline()

      // Check if first stage already filters deleted field
      const firstStage = pipeline[0]
      const hasDeletedFilter = firstStage?.$match?.[opts.deletedField] !== undefined

      if (!hasDeletedFilter) {
        pipeline.unshift({ $match: { [opts.deletedField]: { $ne: true } } })
      }
    })
  }

  // Add instance method to restore soft-deleted documents
  schema.methods.restore = async function (this: any) {
    this[opts.deletedField] = false
    if (opts.deletedAt) {
      this[opts.deletedAtField] = null
    }
    if (opts.deletedBy) {
      this[opts.deletedByField] = null
    }
    return await this.save()
  }

  // Add static method to restore by query
  schema.statics.restore = async function (this: any, filter: any) {
    const update: any = {
      [opts.deletedField]: false,
    }
    if (opts.deletedAt) {
      update[opts.deletedAtField] = null
    }
    if (opts.deletedBy) {
      update[opts.deletedByField] = null
    }

    return await this.updateMany({ ...filter, [opts.deletedField]: true }, { $set: update })
  }
}
