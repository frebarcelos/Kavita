using Kavita.Common.Constants;
using Kavita.Server.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace Kavita.Server.Tests;

public class FolderCatalogMaintenanceTests
{
    [Theory]
    [InlineData(true, true, "/api/series/v2", 503, false)]
    [InlineData(true, true, "/api/reader/progress", 503, false)]
    [InlineData(true, false, "/api/series/all-v2", 200, true)]
    [InlineData(false, true, "/api/series/v2", 200, true)]
    [InlineData(true, false, "/api/health", 200, true)]
    public async Task Maintenance_ProtectsApiKeyClientsWithoutBlockingTheWeb(
        bool enabled, bool apiKey, string path, int status, bool expectedNext)
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["FolderOrganization:ApiKeyMaintenance"] = enabled.ToString()
        }).Build();
        var called = false;
        var middleware = new FolderCatalogMaintenanceMiddleware(_ => { called = true; return Task.CompletedTask; }, config);
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.Request.Headers.Authorization = "Bearer synthetic";
        if (apiKey) context.Request.Headers[Headers.ApiKey] = "synthetic";
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        Assert.Equal(status, context.Response.StatusCode);
        Assert.Equal(expectedNext, called);
        if (!expectedNext)
        {
            context.Response.Body.Position = 0;
            Assert.Contains("folder-catalog-client-update-required", await new StreamReader(context.Response.Body).ReadToEndAsync());
        }
    }
}
