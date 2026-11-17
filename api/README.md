## Install EF Core Tools

```bash
dotnet tool install --global dotnet-ef
```

## Build or Update Migrations

```bash
dotnet ef migrations add InitialCreate --project ./src/TAKAHATA.Infrastructure/ --startup-project ./src/TAKAHATA.Api/ --output-dir Persistence/Migrations
dotnet ef migrations add update-db-261013-001 --project ./src/TAKAHATA.Infrastructure/ --startup-project ./src/TAKAHATA.Api/ --output-dir Persistence/Migrations


dotnet ef database update --project ./src/TAKAHATA.Infrastructure/ --startup-project ./src/TAKAHATA.Api/
```

## Docker

Start the MySQL container before running the API:

```bash
docker compose up -d
```

The API connection string must match the local MySQL instance in use:
- port: `3306`
- user: `root`
- password: `200804`
- database: `TAKAHATA_DB`

Then run:

```bash
dotnet run --project ./src/TAKAHATA.Api
```
