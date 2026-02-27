
export const requestTimer = (req: any, res: any, next: any) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 50) {
      console.log(`${req.method} ${req.originalUrl} took ${duration}ms`);
    }
  });
  next();
};
