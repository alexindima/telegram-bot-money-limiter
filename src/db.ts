import path from 'path';
import Database from 'better-sqlite3';

const dbPath = path.resolve(__dirname, '../database.sqlite');

const db = new Database(dbPath);

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        totalAmount REAL NOT NULL,
        days INTEGER NOT NULL,
        startDate TEXT NOT NULL,
        purchases TEXT DEFAULT '[]'
    )
`);

export function saveUser(id: number, totalAmount: number, days: number): void {
    const startDate = new Date().toISOString();
    const query = `
        INSERT INTO users (id, totalAmount, days, startDate)
        VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET totalAmount = ?, days = ?, startDate = ?`;
    db.prepare(query).run(id, totalAmount, days, startDate, totalAmount, days, startDate);
}

export function getUser(id: number): User {
    const query = `SELECT * FROM users WHERE id = ?`;
    return db.prepare(query).get(id) as User;
}

export function updateUser(id: number, totalAmount: number, purchases: number[]): void {
    const query = `
        UPDATE users
        SET totalAmount = ?, purchases = ?
        WHERE id = ?`;
    db.prepare(query).run(totalAmount, JSON.stringify(purchases), id);
}

export function deleteUser(id: number): void {
    const query = `DELETE FROM users WHERE id = ?`;
    db.prepare(query).run(id);
}

export interface User {
    id: number;
    totalAmount: number;
    days: number;
    startDate: string;
    purchases: string;
}

