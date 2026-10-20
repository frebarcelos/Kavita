using System;
using System.Collections.Concurrent;
using System.Linq;

namespace Kavita.Server.Helpers;

/// <summary>
/// Fork: limits how often one user saves progress on one chapter. Readers save a page at a time, the web after half a
/// second on it; a client stuck in a loop once sent thousands of saves in minutes. Saves of other chapters and of
/// other users are not held back, so a tablet can send many chapters at once when it syncs.
/// </summary>
public class ProgressWriteThrottle(Func<DateTime>? utcNow = null)
{
    public static readonly TimeSpan MinInterval = TimeSpan.FromMilliseconds(300);
    private const int PruneAbove = 10_000;

    private readonly Func<DateTime> _utcNow = utcNow ?? (() => DateTime.UtcNow);
    private readonly ConcurrentDictionary<(int UserId, int ChapterId), DateTime> _lastSave = new();

    public bool TryAcquire(int userId, int chapterId)
    {
        var now = _utcNow();
        var allowed = false;
        _lastSave.AddOrUpdate((userId, chapterId),
            _ => { allowed = true; return now; },
            (_, last) =>
            {
                if (now - last < MinInterval)
                {
                    allowed = false;
                    return last;
                }
                allowed = true;
                return now;
            });

        if (_lastSave.Count > PruneAbove) Prune(now);
        return allowed;
    }

    private void Prune(DateTime now)
    {
        foreach (var key in _lastSave.Where(e => now - e.Value > TimeSpan.FromMinutes(1)).Select(e => e.Key).ToList())
        {
            _lastSave.TryRemove(key, out _);
        }
    }
}
