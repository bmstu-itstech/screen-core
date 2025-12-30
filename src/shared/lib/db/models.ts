import { Schema, model, models } from 'mongoose';

const OrgUnitSchema = new Schema({
    name: { type: String, required: true },
    type: { type: String, enum: ['root', 'branch', 'floor', 'room'], required: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'OrgUnit', default: null },
    path: { type: String, index: true },

    isActive: { type: Boolean, default: false },

    currentMode: { type: String, enum: ['slideshow', 'video'], default: 'slideshow' },
    playlist: [{
        materialId: { type: Schema.Types.ObjectId, ref: 'Material' },
        duration: Number,
        order: Number,
        isMuted: { type: Boolean, default: false }
    }],
    timework: { type: [Number], default: [0, 86400] },
    volume: { type: Number, default: 100 },

}, { timestamps: true });

const UserSchema = new Schema({
    login: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['root', 'admin'], default: 'admin' },
    orgUnitId: { type: Schema.Types.ObjectId, ref: 'OrgUnit' },
});

const DeviceSchema = new Schema({
    uid: { type: String, required: true, unique: true },
    name: { type: String, default: 'New Display' },
    orgUnitId: { type: Schema.Types.ObjectId, ref: 'OrgUnit' },
    status: { type: String, enum: ['online', 'offline'], default: 'offline' },
    currentMode: { type: String, enum: ['slideshow', 'video'], default: 'slideshow' },

    volume: { type: Number, default: 100 },

    playlist: [{
        materialId: { type: Schema.Types.ObjectId, ref: 'Material' },
        duration: Number,
        order: Number,
        isMuted: { type: Boolean, default: false }
    }],
    timework: { type: [Number], default: [0, 86400] },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

const FolderSchema = new Schema({
    name: { type: String, required: true },
    parentId: { type: String, default: 'root' },
}, { timestamps: true });

const MaterialSchema = new Schema({
    title: { type: String, required: true },
    filename: { type: String, required: true },
    type: { type: String, enum: ['image', 'video'] },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    folder: { type: String, default: 'root' },
    folderId: { type: String, default: 'root', index: true },
}, { timestamps: true });

const LogSchema = new Schema({
    level: { type: String, enum: ['info', 'warn', 'error'], required: true },
    action: { type: String, required: true },
    details: { type: Object },
    actorId: { type: String },
    timestamp: { type: Date, default: Date.now },
    orgUnitId: { type: Schema.Types.ObjectId, ref: 'OrgUnit' }
});

export const OrgUnit = models.OrgUnit || model('OrgUnit', OrgUnitSchema);
export const User = models.User || model('User', UserSchema);
export const Device = models.Device || model('Device', DeviceSchema);
export const Material = models.Material || model('Material', MaterialSchema);
export const Log = models.Log || model('Log', LogSchema);
export const Folder = models.Folder || model('Folder', FolderSchema);
