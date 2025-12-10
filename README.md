# 🗑️ Mongoose Paranoia

A powerful Mongoose plugin that adds **soft delete** functionality with paranoid mode support. Keep your data safe while maintaining a clean database interface.

[![npm version](https://img.shields.io/github/package-json/v/jsupa/mongoose-paranoia)](https://github.com/jsupa/mongoose-paranoia/packages)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🛡️ **Soft Delete** - Mark records as deleted without actually removing them
- 🔍 **Flexible Query Modes** - Three filtering strategies to fit your needs
- 🕐 **Timestamp Tracking** - Automatically record when items were deleted
- 👤 **User Tracking** - Optional field to track who deleted the record
- 🔄 **Easy Restoration** - Built-in methods to restore soft-deleted records
- 📝 **TypeScript Support** - Full type safety with TypeScript
- 🎯 **Zero Config** - Works out of the box with sensible defaults

## 📦 Installation

```bash
# From GitHub Packages
npm install @jsupa/mongoose-paranoia

# Or with pnpm
pnpm add @jsupa/mongoose-paranoia

# Or with yarn
yarn add @jsupa/mongoose-paranoia
```

## 🚀 Quick Start

```typescript
import mongoose from 'mongoose';
import Paranoia from '@jsupa/mongoose-paranoia';

// Define your schema
const userSchema = new mongoose.Schema({
  name: String,
  email: String
});

// Add the plugin
userSchema.plugin(Paranoia);

// Create your model
const User = mongoose.model('User', userSchema);

// Use it like normal - deletes are now soft!
await User.deleteOne({ email: 'user@example.com' }); // Soft delete
const users = await User.find(); // Only returns non-deleted users
```

## 📖 Usage

### Basic Example

```typescript
import mongoose, { Schema, Model } from 'mongoose';
import Paranoia, { 
  type ParanoiaDocument, 
  type ParanoiaQueryHelpers, 
  type ParanoiaStatics 
} from '@jsupa/mongoose-paranoia';

interface IUser extends ParanoiaDocument {
  name: string;
  email: string;
}

const userSchema = new Schema<
  IUser,
  Model<IUser, ParanoiaQueryHelpers> & ParanoiaStatics,
  {},
  ParanoiaQueryHelpers
>({
  name: String,
  email: String
});

userSchema.plugin(Paranoia, {
  deletedAt: true,        // Add deletedAt timestamp
  deletedBy: false,       // Don't track who deleted
  activeArchive: 'Default' // Auto-filter deleted records
});

const User = mongoose.model<IUser, Model<IUser, ParanoiaQueryHelpers> & ParanoiaStatics>('User', userSchema);
```

### Configuration Options

```typescript
interface ParanoiaOptions {
  // Enable deletedAt timestamp field (default: true)
  deletedAt?: boolean;
  
  // Enable deletedBy field to track who deleted (default: false)
  deletedBy?: boolean;
  
  // Type of deletedBy field: 'ObjectId' or 'String' (default: 'ObjectId')
  deletedByType?: string;
  
  // Filtering strategy (default: 'Default')
  // - "Default": Auto-filter deleted records (use .withDeleted() to include)
  // - "Scope": Must explicitly use .active() or .deleted()
  // - "All": Return all records by default (use .active() to filter)
  activeArchive?: 'Scope' | 'Default' | 'All';
  
  // Customize field names
  deletedField?: string;      // default: 'deleted'
  deletedAtField?: string;    // default: 'deletedAt'
  deletedByField?: string;    // default: 'deletedBy'
}
```

## 🎯 Active Archive Modes

### Default Mode (Recommended)

Automatically filters out deleted records. Use `.withDeleted()` to include them.

```typescript
userSchema.plugin(Paranoia, { activeArchive: 'Default' });

// Only returns non-deleted users
const activeUsers = await User.find();

// Returns all users including deleted
const allUsers = await User.find().withDeleted();

// Only returns deleted users
const deletedUsers = await User.find().deleted();
```

### Scope Mode

Must explicitly use query helpers for filtering.

```typescript
userSchema.plugin(Paranoia, { activeArchive: 'Scope' });

// Returns ALL users (including deleted)
const allUsers = await User.find();

// Returns only active users
const activeUsers = await User.find().active();

// Returns only deleted users
const deletedUsers = await User.find().deleted();
```

### All Mode

Returns everything by default. Use `.active()` to filter.

```typescript
userSchema.plugin(Paranoia, { activeArchive: 'All' });

// Returns ALL users
const allUsers = await User.find();

// Returns only active users
const activeUsers = await User.find().active();
```

## 🔨 API Reference

### Query Helpers

All query helpers work with `find()`, `findOne()`, `countDocuments()`, and `aggregate()`:

```typescript
// Get only active (non-deleted) records
const active = await User.find().active();

// Get only deleted records
const deleted = await User.find().deleted();

// Get all records (bypass default filtering)
const all = await User.find().withDeleted();
```

### Soft Delete Methods

All standard Mongoose delete operations are converted to soft deletes:

```typescript
// Delete one document
await User.deleteOne({ email: 'user@example.com' });

// Delete multiple documents
await User.deleteMany({ inactive: true });

// Find and delete
await User.findOneAndDelete({ _id: userId });
await User.findByIdAndDelete(userId);
```

### Restore Methods

```typescript
// Restore a single document (instance method)
const user = await User.findById(userId).withDeleted();
await user.restore();

// Restore multiple documents (static method)
await User.restore({ email: { $in: emailList } });
```

### Document Fields

Every document has these additional fields:

```typescript
interface ParanoiaDocument {
  deleted: boolean;        // Indicates if soft-deleted
  deletedAt?: Date;        // Timestamp of deletion (if enabled)
  deletedBy?: any;         // Who deleted it (if enabled)
  restore(): Promise<this>; // Restore the document
}
```

## 🎨 Advanced Examples

### Track Who Deleted Records

```typescript
userSchema.plugin(Paranoia, {
  deletedBy: true,
  deletedByType: 'ObjectId' // or 'String'
});

// You'll need to manually set deletedBy in your delete logic
const deletedUser = await User.findByIdAndUpdate(userId, {
  deleted: true,
  deletedAt: new Date(),
  deletedBy: currentUserId
});
```

### Custom Field Names

```typescript
userSchema.plugin(Paranoia, {
  deletedField: 'isArchived',
  deletedAtField: 'archivedAt',
  deletedByField: 'archivedBy'
});
```

### Aggregation with Soft Deletes

```typescript
// In Default mode, deleted records are automatically filtered
const stats = await User.aggregate([
  { $group: { _id: '$status', count: { $sum: 1 } } }
]);

// Include deleted records in aggregation
const allStats = await User.aggregate([
  { $group: { _id: '$status', count: { $sum: 1 } } }
]).withDeleted();
```

## 🔧 TypeScript Support

Full TypeScript support with proper type definitions:

```typescript
import mongoose, { Model, Schema } from 'mongoose';
import Paranoia, { 
  type ParanoiaDocument, 
  type ParanoiaQueryHelpers, 
  type ParanoiaStatics 
} from '@jsupa/mongoose-paranoia';

interface IUser extends ParanoiaDocument {
  name: string;
  email: string;
}

const userSchema = new Schema<
  IUser,
  Model<IUser, ParanoiaQueryHelpers> & ParanoiaStatics,
  {},
  ParanoiaQueryHelpers
>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true }
});

userSchema.plugin(Paranoia);

const User = mongoose.model<IUser, Model<IUser, ParanoiaQueryHelpers> & ParanoiaStatics>('User', userSchema);

// Now you have full type safety!
```

### Type Helpers

The plugin exports several TypeScript helpers to make your code more type-safe:

#### `SoftDeleteDocument<T>`

A type helper that combines your document interface with `ParanoiaDocument`:

```typescript
interface IUser {
  name: string;
  email: string;
}

// Automatically includes: deleted, deletedAt, deletedBy, restore()
type UserDocument = SoftDeleteDocument<IUser>;
```

#### `ParanoiaModel<T, TQueryHelpers>`

An enhanced Model interface that includes all Paranoia plugin methods:

```typescript
type UserModel = ParanoiaModel<UserDocument, ParanoiaQueryHelpers>;

// Provides type-safe access to:
// - model.restore(filter)
// - All overridden delete methods
```

#### `ParanoiaQueryHelpers`

Query helper interface for type-safe query methods:

```typescript
const userSchema = new Schema<UserDocument, UserModel, {}, ParanoiaQueryHelpers>({
  // schema definition
});

// Provides type-safe access to:
// - query.active()
// - query.deleted()
// - query.withDeleted()
```

### Full TypeScript Example

```typescript
import mongoose, { Schema, Model } from 'mongoose';
import Paranoia, { 
  type ParanoiaDocument, 
  type ParanoiaQueryHelpers, 
  type ParanoiaStatics 
} from '@jsupa/mongoose-paranoia';

// 1. Define your interface extending ParanoiaDocument
interface IUser extends ParanoiaDocument {
  name: string;
  email: string;
}

// 2. Define schema with full type safety
const userSchema = new Schema<
  IUser,
  Model<IUser, ParanoiaQueryHelpers> & ParanoiaStatics,
  {},
  ParanoiaQueryHelpers
>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true }
});

// 3. Add plugin
userSchema.plugin(Paranoia);

// 4. Create model
const User = mongoose.model<IUser, Model<IUser, ParanoiaQueryHelpers> & ParanoiaStatics>('User', userSchema);

// 5. Use with full type safety!
const user = await User.create({ name: 'John', email: 'john@example.com' });
await user.restore(); // ✅ Type-safe instance method

await User.restore({ email: 'john@example.com' }); // ✅ Type-safe static method

const activeUsers = await User.find().active(); // ✅ Type-safe query helper
```

## 🧪 Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with UI
pnpm test:ui
```

## 📄 License

MIT © [jsupa](https://github.com/jsupa)

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🙏 Acknowledgments

Inspired by the need for better soft delete functionality in Mongoose applications.

## 📝 Changelog

See [Releases](https://github.com/jsupa/mongoose-paranoia/releases) for changelog.

---

Made with ❤️ by [jsupa](https://github.com/jsupa)
