import bcrypt from "bcrypt";

export const hashPassword = async (password: string) => {
    const hashPassword = await bcrypt.hash(password, 10);

    return hashPassword
}