# Redefine Technologies

```bash
docker build . -t website
docker run --rm -ti -p 3000:3000 -v .:/app website npx astro dev --host 0.0.0.0
```

Then open your browser at: http://localhost:3000/
