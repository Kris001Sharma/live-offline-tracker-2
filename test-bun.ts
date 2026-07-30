import { Database } from "bun:sqlite";

const db = new Database(":memory:");
db.run("CREATE TABLE test (col1, col2);");
db.run("INSERT INTO test VALUES (?,?), (?,?)", [1,111,2,222]);
const query = db.query("SELECT * FROM test");
console.log(JSON.stringify(query.all()));
