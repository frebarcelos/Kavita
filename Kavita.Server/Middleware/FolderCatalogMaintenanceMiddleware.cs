using System.Threading.Tasks;
using Kavita.Common.Constants;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace Kavita.Server.Middleware;

/// <summary>Temporarily pauses API-key clients while a folder catalog migration is validated.</summary>
public class FolderCatalogMaintenanceMiddleware(RequestDelegate next, IConfiguration configuration)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (configuration.GetValue<bool>("FolderOrganization:ApiKeyMaintenance") &&
            context.Request.Path.StartsWithSegments("/api") &&
            !string.IsNullOrEmpty(context.Request.Headers[Headers.ApiKey]))
        {
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            context.Response.Headers.CacheControl = "no-store";
            await context.Response.WriteAsJsonAsync(new { code = "folder-catalog-client-update-required" });
            return;
        }

        await next(context);
    }
}
