export const UUIDToBuffer =  (id: string) => {
    const bufferId = Buffer.from(id.replace(/-/g, ''), 'hex');

    return bufferId;
}