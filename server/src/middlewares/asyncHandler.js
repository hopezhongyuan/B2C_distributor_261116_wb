// asyncHandler — Express 4 不自动捕获 async 抛错，统一包装避免进程崩溃
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
