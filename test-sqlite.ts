import initSqlJs from 'sql.js';

async function test() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("CREATE TABLE test (col1, col2);");
  db.run("INSERT INTO test VALUES (?,?), (?,?)", [1,111,2,222]);
  const res = db.exec("SELECT * FROM test");
  console.log(JSON.stringify(res));
}
test().catch(console.error);
