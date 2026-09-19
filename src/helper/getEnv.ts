export function getEnvName(name: string){
    const value = process.env[name];
    if(value === undefined || value === null) {
        console.log(`Varable name: ${name}`)
        throw new Error(`Invalid Env Variable`);
    };

    return value;
}