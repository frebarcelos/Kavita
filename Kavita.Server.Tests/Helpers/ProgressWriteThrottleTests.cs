using Kavita.Server.Helpers;

namespace Kavita.Server.Tests.Helpers;

public class ProgressWriteThrottleTests
{
    private DateTime _now = new(2026, 10, 19, 20, 0, 0, DateTimeKind.Utc);

    private ProgressWriteThrottle Create() => new(() => _now);

    [Fact]
    public void LetsReadingSaveAPageAtATime()
    {
        var throttle = Create();

        Assert.True(throttle.TryAcquire(1, 10));
        _now += TimeSpan.FromMilliseconds(500);
        Assert.True(throttle.TryAcquire(1, 10));
    }

    [Fact]
    public void RefusesSavesOfTheSameChapterTooCloseTogether()
    {
        // A client stuck in a loop sent thousands of saves in minutes
        var throttle = Create();

        Assert.True(throttle.TryAcquire(1, 10));
        _now += TimeSpan.FromMilliseconds(100);
        Assert.False(throttle.TryAcquire(1, 10));
        _now += TimeSpan.FromMilliseconds(250);
        Assert.True(throttle.TryAcquire(1, 10));
    }

    [Fact]
    public void OtherChaptersAndUsersAreNotHeldBack()
    {
        // A tablet sends the progress of many chapters at once when it syncs
        var throttle = Create();

        Assert.True(throttle.TryAcquire(1, 10));
        Assert.True(throttle.TryAcquire(1, 11));
        Assert.True(throttle.TryAcquire(2, 10));
    }
}
