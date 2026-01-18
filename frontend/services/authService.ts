
import { User, UserRole } from '../types';

// Mock Database of Users
// Refactored Names: Removed Dr./Eng. prefixes for cleaner UI display
let mockUsers: User[] = [
  {
    id: '1',
    username: 'owner',
    password: 'password',
    name: 'James Wu', // Was Eng. James Wu
    role: UserRole.OWNER,
    email: 'james.wu@iearlm.sys',
    department: '系統工程部', // System Engineering
    status: 'active',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=James&clothing=hoodie&accessories=prescription02&top=shortFlat&hairColor=2c1b18&skinColor=f5d0c5&mouth=smile&eyebrows=raisedExcited'
  },
  {
    id: '2',
    username: 'manager',
    password: 'password',
    name: 'Sarah Jones', // Was Director Sarah Jones
    role: UserRole.MANAGER,
    email: 'sarah.j@clinic.admin',
    department: '醫院行政部', // Hospital Administration
    status: 'active',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Sarah&clothing=blazerAndShirt&top=straight01&hairColor=4a312c&skinColor=ffdbb4&mouth=smile&eyebrows=raisedExcited'
  },
  {
    id: '3',
    username: 'doctor',
    password: 'password',
    name: 'Emily Chen', // Was Dr. Emily Chen
    role: UserRole.USER,
    email: 'dr.emily@ent.dept',
    department: '耳鼻喉科 (ENT)', // Otolaryngology (ENT)
    status: 'active',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Emily&clothing=blazerAndSweater&top=bun&hairColor=2c1b18&skinColor=f5d0c5&mouth=smile&eyebrows=raisedExcited'
  },
  {
    id: '4',
    username: 'suspended_user',
    password: 'password',
    name: 'Mark Lee',
    role: UserRole.USER,
    email: 'mark.lee@intern.dept',
    department: '一般內科', // General Medicine
    status: 'suspended',
    avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Mark&clothing=collarAndSweater&mouth=serious'
  }
];

export const login = async (username: string, password: string): Promise<User | null> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const user = mockUsers.find(u => u.username === username && u.password === password);
  
  if (user) {
    if (user.status === 'suspended') return null; // Block suspended users
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }
  return null;
};

export const register = async (username: string, password: string, name: string): Promise<User | null> => {
  await new Promise(resolve => setTimeout(resolve, 800));
  const exists = mockUsers.some(u => u.username === username);
  if (exists) return null;

  const newUser: User = {
    id: Date.now().toString(),
    username,
    password,
    name,
    role: UserRole.USER, 
    email: `${username}@hospital.org`, // Default email gen
    department: 'General Staff',
    status: 'active',
    avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=${username}&clothing=blazerAndShirt&top=shortFlat&mouth=smile&eyebrows=raisedExcited`
  };

  mockUsers.push(newUser);
  const { password: _, ...userWithoutPassword } = newUser;
  return userWithoutPassword as User;
};

export const getUsers = async (): Promise<User[]> => {
  return mockUsers.map(({ password: _, ...user }) => user as User);
};

export const addUser = async (newUser: Omit<User, 'id'>): Promise<User> => {
  const user = { ...newUser, id: Date.now().toString() };
  mockUsers = [...mockUsers, user];
  const { password: _, ...safeUser } = user;
  return safeUser as User;
};

export const updateUser = async (id: string, updatedData: Partial<User>): Promise<User | null> => {
  const index = mockUsers.findIndex(u => u.id === id);
  if (index === -1) return null;

  mockUsers[index] = { ...mockUsers[index], ...updatedData };
  const { password: _, ...safeUser } = mockUsers[index];
  return safeUser as User;
};

export const deleteUser = async (id: string): Promise<void> => {
  mockUsers = mockUsers.filter(u => u.id !== id);
};
