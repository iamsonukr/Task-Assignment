export enum Role { Admin = 'admin', Manager = 'manager', User = 'user' }
export const isPrivileged = (role: Role) => role === Role.Admin || role === Role.Manager;
