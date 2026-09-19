import app from "./app.js";
import { checkDBConnection } from "./config/database.js";
import {getEnvName} from "./helper/getEnv.js"

const port = getEnvName("PORT");

const startServer = async (): Promise<void> => {
    try {
        // Fail fast: don't start accepting requests if the DB is unreachable.
        await checkDBConnection();

        app.listen(port, () => {
            console.log(`Server is running in port: ${port}`);
        });
    } catch (err) {
        console.error("Failed to connect to the database:", err);
        process.exit(1);
    }
};

startServer();