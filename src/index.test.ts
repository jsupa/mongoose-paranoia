import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import mongoose, { Schema, model, Model } from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import Paranoia, { type ParanoiaDocument, type ParanoiaQueryHelpers, type ParanoiaStatics } from './index.js'

let mongoServer: MongoMemoryServer

// Test interfaces
interface IUser extends ParanoiaDocument {
  name: string
  email: string
}

// Models for each test scenario
let UserDefault: Model<IUser, ParanoiaQueryHelpers> & ParanoiaStatics
let UserScope: Model<IUser, ParanoiaQueryHelpers> & ParanoiaStatics
let UserAll: Model<IUser, ParanoiaQueryHelpers> & ParanoiaStatics

beforeAll(async () => {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create()
  const mongoUri = mongoServer.getUri()
  await mongoose.connect(mongoUri)
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

beforeEach(async () => {
  // Clear all collections before each test
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key]!.deleteMany({})
  }

  // Delete models to recreate them
  if (mongoose.models.UserDefault) delete mongoose.models.UserDefault
  if (mongoose.models.UserScope) delete mongoose.models.UserScope
  if (mongoose.models.UserAll) delete mongoose.models.UserAll

  // Create schemas for each activeArchive mode
  const schemaDefault = new Schema<
    IUser,
    Model<IUser, ParanoiaQueryHelpers> & ParanoiaStatics,
    {},
    ParanoiaQueryHelpers
  >({
    name: String,
    email: String,
  })
  schemaDefault.plugin(Paranoia, { activeArchive: 'Default' })
  UserDefault = model<IUser, Model<IUser, ParanoiaQueryHelpers> & ParanoiaStatics>(
    'UserDefault',
    schemaDefault,
  ) as Model<IUser, ParanoiaQueryHelpers> & ParanoiaStatics

  const schemaScope = new Schema<IUser, Model<IUser, ParanoiaQueryHelpers> & ParanoiaStatics, {}, ParanoiaQueryHelpers>(
    {
      name: String,
      email: String,
    },
  )
  schemaScope.plugin(Paranoia, { activeArchive: 'Scope' })
  UserScope = model<IUser, Model<IUser, ParanoiaQueryHelpers> & ParanoiaStatics>('UserScope', schemaScope) as Model<
    IUser,
    ParanoiaQueryHelpers
  > &
    ParanoiaStatics

  const schemaAll = new Schema<IUser, Model<IUser, ParanoiaQueryHelpers> & ParanoiaStatics, {}, ParanoiaQueryHelpers>({
    name: String,
    email: String,
  })
  schemaAll.plugin(Paranoia, { activeArchive: 'All' })
  UserAll = model<IUser, Model<IUser, ParanoiaQueryHelpers> & ParanoiaStatics>('UserAll', schemaAll) as Model<
    IUser,
    ParanoiaQueryHelpers
  > &
    ParanoiaStatics
})

describe('Paranoia Plugin - Schema Fields', () => {
  it('should add deleted field to schema', async () => {
    const user = await UserDefault.create({ name: 'John', email: 'john@test.com' })
    expect(user.deleted).toBe(false)
  })

  it('should add deletedAt field when enabled', async () => {
    const user = await UserDefault.create({ name: 'John', email: 'john@test.com' })
    expect(user.deletedAt).toBeNull()
  })

  it('should add deletedBy field when enabled', async () => {
    const schemaWithDeletedBy = new Schema({ name: String })
    schemaWithDeletedBy.plugin(Paranoia, { deletedBy: true })
    const UserWithDeletedBy = model('UserWithDeletedBy', schemaWithDeletedBy)

    const user = await UserWithDeletedBy.create({ name: 'John' })
    expect(user.get('deletedBy')).toBeNull()

    delete mongoose.models.UserWithDeletedBy
  })
})

describe('Paranoia Plugin - activeArchive: "Default"', () => {
  it('should automatically filter deleted records on find()', async () => {
    await UserDefault.create({ name: 'Active User', email: 'active@test.com' })
    await UserDefault.create({ name: 'Deleted User', email: 'deleted@test.com', deleted: true })

    const users = await UserDefault.find()
    expect(users).toHaveLength(1)
    expect(users[0]!.name).toBe('Active User')
  })

  it('should automatically filter deleted records on findOne()', async () => {
    await UserDefault.create({ name: 'Active', email: 'active@test.com' })
    await UserDefault.create({ name: 'Deleted', email: 'deleted@test.com', deleted: true })

    const user = await UserDefault.findOne({ email: 'deleted@test.com' })
    expect(user).toBeNull()
  })

  it('should automatically filter deleted records on findById()', async () => {
    const deleted = await UserDefault.create({ name: 'Deleted', email: 'deleted@test.com', deleted: true })
    const user = await UserDefault.findById(deleted._id)
    expect(user).toBeNull()
  })

  it('should automatically filter deleted records on countDocuments()', async () => {
    await UserDefault.create({ name: 'Active 1', email: 'active1@test.com' })
    await UserDefault.create({ name: 'Active 2', email: 'active2@test.com' })
    await UserDefault.create({ name: 'Deleted', email: 'deleted@test.com', deleted: true })

    const count = await UserDefault.countDocuments()
    expect(count).toBe(2)
  })

  it('should automatically filter deleted records on aggregate()', async () => {
    await UserDefault.create({ name: 'Active', email: 'active@test.com' })
    await UserDefault.create({ name: 'Deleted', email: 'deleted@test.com', deleted: true })

    const result = await UserDefault.aggregate([{ $count: 'total' }])
    expect(result[0].total).toBe(1)
  })

  it('should use .active to explicitly get active records', async () => {
    await UserDefault.create({ name: 'Active', email: 'active@test.com' })
    await UserDefault.create({ name: 'Deleted', email: 'deleted@test.com', deleted: true })

    const users = await UserDefault.find().active()
    expect(users).toHaveLength(1)
    expect(users[0].name).toBe('Active')
  })

  it('should use .deleted to get only deleted records', async () => {
    await UserDefault.create({ name: 'Active', email: 'active@test.com' })
    await UserDefault.create({ name: 'Deleted', email: 'deleted@test.com', deleted: true })

    const users = await UserDefault.find().deleted()
    expect(users).toHaveLength(1)
    expect(users[0].name).toBe('Deleted')
  })

  it('should use .withDeleted to get all records', async () => {
    await UserDefault.create({ name: 'Active', email: 'active@test.com' })
    await UserDefault.create({ name: 'Deleted', email: 'deleted@test.com', deleted: true })

    const users = await UserDefault.find().withDeleted()
    expect(users).toHaveLength(2)
  })
})

describe('Paranoia Plugin - activeArchive: "Scope"', () => {
  it('should return all records by default on find()', async () => {
    await UserScope.create({ name: 'Active', email: 'active@test.com' })
    await UserScope.create({ name: 'Deleted', email: 'deleted@test.com', deleted: true })

    const users = await UserScope.find()
    expect(users).toHaveLength(2)
  })

  it('should use .active to get only active records', async () => {
    await UserScope.create({ name: 'Active', email: 'active@test.com' })
    await UserScope.create({ name: 'Deleted', email: 'deleted@test.com', deleted: true })

    const users = await UserScope.find().active()
    expect(users).toHaveLength(1)
    expect(users[0].name).toBe('Active')
  })

  it('should use .deleted to get only deleted records', async () => {
    await UserScope.create({ name: 'Active', email: 'active@test.com' })
    await UserScope.create({ name: 'Deleted', email: 'deleted@test.com', deleted: true })

    const users = await UserScope.find().deleted()
    expect(users).toHaveLength(1)
    expect(users[0].name).toBe('Deleted')
  })

  it('should return all records on aggregate()', async () => {
    await UserScope.create({ name: 'Active', email: 'active@test.com' })
    await UserScope.create({ name: 'Deleted', email: 'deleted@test.com', deleted: true })

    const result = await UserScope.aggregate([{ $count: 'total' }])
    expect(result[0].total).toBe(2)
  })

  it('should return all records on countDocuments()', async () => {
    await UserScope.create({ name: 'Active', email: 'active@test.com' })
    await UserScope.create({ name: 'Deleted', email: 'deleted@test.com', deleted: true })

    const count = await UserScope.countDocuments()
    expect(count).toBe(2)
  })
})

describe('Paranoia Plugin - activeArchive: "All"', () => {
  it('should return all records by default on find()', async () => {
    await UserAll.create({ name: 'Active', email: 'active@test.com' })
    await UserAll.create({ name: 'Deleted', email: 'deleted@test.com', deleted: true })

    const users = await UserAll.find()
    expect(users).toHaveLength(2)
  })

  it('should use .active to filter to active records', async () => {
    await UserAll.create({ name: 'Active', email: 'active@test.com' })
    await UserAll.create({ name: 'Deleted', email: 'deleted@test.com', deleted: true })

    const users = await UserAll.find().active()
    expect(users).toHaveLength(1)
    expect(users[0].name).toBe('Active')
  })

  it('should use .deleted to filter to deleted records', async () => {
    await UserAll.create({ name: 'Active', email: 'active@test.com' })
    await UserAll.create({ name: 'Deleted', email: 'deleted@test.com', deleted: true })

    const users = await UserAll.find().deleted()
    expect(users).toHaveLength(1)
    expect(users[0].name).toBe('Deleted')
  })

  it('should return all records on aggregate()', async () => {
    await UserAll.create({ name: 'Active', email: 'active@test.com' })
    await UserAll.create({ name: 'Deleted', email: 'deleted@test.com', deleted: true })

    const result = await UserAll.aggregate([{ $count: 'total' }])
    expect(result[0].total).toBe(2)
  })

  it('should return all records on countDocuments()', async () => {
    await UserAll.create({ name: 'Active', email: 'active@test.com' })
    await UserAll.create({ name: 'Deleted', email: 'deleted@test.com', deleted: true })

    const count = await UserAll.countDocuments()
    expect(count).toBe(2)
  })
})

describe('Paranoia Plugin - Soft Delete Operations', () => {
  it('should soft delete with deleteOne()', async () => {
    const user = await UserDefault.create({ name: 'John', email: 'john@test.com' })

    await UserDefault.deleteOne({ _id: user._id })

    const deletedUser = await UserDefault.findById(user._id).withDeleted()
    expect(deletedUser?.deleted).toBe(true)
    expect(deletedUser?.deletedAt).toBeInstanceOf(Date)
  })

  it('should soft delete with deleteMany()', async () => {
    await UserDefault.create({ name: 'User 1', email: 'user1@test.com' })
    await UserDefault.create({ name: 'User 2', email: 'user2@test.com' })

    await UserDefault.deleteMany({})

    const users = await UserDefault.find().withDeleted()
    expect(users).toHaveLength(2)
    expect(users.every((u: IUser) => u.deleted === true)).toBe(true)
  })

  it('should soft delete with findOneAndDelete()', async () => {
    const user = await UserDefault.create({ name: 'John', email: 'john@test.com' })

    await UserDefault.findOneAndDelete({ _id: user._id })

    const deletedUser = await UserDefault.findById(user._id).withDeleted()
    expect(deletedUser?.deleted).toBe(true)
  })

  it('should soft delete with findByIdAndDelete()', async () => {
    const user = await UserDefault.create({ name: 'John', email: 'john@test.com' })

    await UserDefault.findByIdAndDelete(user._id)

    const deletedUser = await UserDefault.findById(user._id).withDeleted()
    expect(deletedUser?.deleted).toBe(true)
  })
})

describe('Paranoia Plugin - Restore Functionality', () => {
  it('should restore a soft-deleted document with instance method', async () => {
    const user = await UserDefault.create({ name: 'John', email: 'john@test.com' })

    await UserDefault.deleteOne({ _id: user._id })

    let deletedUser = await UserDefault.findById(user._id).withDeleted()
    expect(deletedUser.deleted).toBe(true)

    await deletedUser.restore()

    const restoredUser = await UserDefault.findById(user._id)
    expect(restoredUser?.deleted).toBe(false)
    expect(restoredUser?.deletedAt).toBeNull()
  })

  it('should restore documents with static method', async () => {
    await UserDefault.create({ name: 'User 1', email: 'user1@test.com' })
    await UserDefault.create({ name: 'User 2', email: 'user2@test.com' })

    await UserDefault.deleteMany({})

    const deletedCount = await UserDefault.countDocuments().deleted()
    expect(deletedCount).toBe(2)

    await UserDefault.restore({})

    const activeCount = await UserDefault.countDocuments()
    expect(activeCount).toBe(2)
  })
})

describe('Paranoia Plugin - Custom Field Names', () => {
  it('should use custom field names', async () => {
    const schema = new Schema({ name: String })
    schema.plugin(Paranoia, {
      deletedField: 'isDeleted',
      deletedAtField: 'removedAt',
    })
    const CustomUser = model('CustomUser', schema)

    const user = await CustomUser.create({ name: 'John' })
    expect(user.get('isDeleted')).toBe(false)
    expect(user.get('removedAt')).toBeNull()

    await CustomUser.deleteOne({ _id: user._id })

    const deletedUser = await CustomUser.findOne({ _id: user._id }).where('isDeleted').equals(true)
    console.log(deletedUser)
    expect(deletedUser?.get('isDeleted')).toBe(true)
    expect(deletedUser?.get('removedAt')).toBeInstanceOf(Date)

    delete mongoose.models.CustomUser
  })
})

describe('Paranoia Plugin - DeletedBy Field', () => {
  it('should track deletedBy when enabled', async () => {
    const schema = new Schema({ name: String })
    schema.plugin(Paranoia, { deletedBy: true, deletedByType: 'String' })
    const UserWithDeletedBy = model('UserWithDeletedBy', schema)

    const user = await UserWithDeletedBy.create({ name: 'John' })

    // Manually set deletedBy (in real app, this would come from auth context)
    await UserWithDeletedBy.updateOne(
      { _id: user._id },
      { deleted: true, deletedBy: 'admin-user-id', deletedAt: new Date() },
    )

    const deletedUser = await UserWithDeletedBy.findOne({ _id: user._id }).where('deleted').equals(true)
    expect(deletedUser?.get('deletedBy')).toBe('admin-user-id')

    delete mongoose.models.UserWithDeletedBy
  })
})
