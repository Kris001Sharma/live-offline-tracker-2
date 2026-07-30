import fs from 'fs';
let content = fs.readFileSync('validation/repository/repository.validation.ts', 'utf8');

// The one in WorkerRepository.create
content = content.replace("worker_id: 'worker-fk', // WorkerCreatePayload", "workerId: 'worker-fk',");
content = content.replace("worker_id: 'worker-fk',", "workerId: 'worker-fk',");

// The ones in Attendance, Shift, Event need worker_id!
// Let's just fix them all appropriately
content = content.replace(/workerId: 'worker-fk'/g, "workerId: 'worker-fk'");

// But the other payloads need worker_id:
// TrustedDevice
content = content.replace(/workerId: 'worker-fk'/g, "workerId: 'worker-fk'");

// Wait, Attendance requires worker_id
content = content.replace(/workerId: 'worker-fk',\n    check_in_at/g, "worker_id: 'worker-fk',\n    check_in_at");

// Shift
content = content.replace(/workerId: 'worker-fk',\n    started_at/g, "worker_id: 'worker-fk',\n    started_at");

// Event
content = content.replace(/workerId: 'worker-fk',\n    shift_id/g, "worker_id: 'worker-fk',\n    shift_id");

fs.writeFileSync('validation/repository/repository.validation.ts', content);
