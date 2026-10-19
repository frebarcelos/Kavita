using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Kavita.Models.DTOs;
using Kavita.Models.Entities;
using Kavita.Models.Entities.Enums;

namespace Kavita.API.Repositories;

[Flags]
public enum VolumeIncludes
{
    None = 1 << 0,
    Chapters = 1 << 1,
    People = 1 << 2,
    Tags = 1 << 3,
    /// <summary>
    /// This will include Chapters by default
    /// </summary>
    Files = 1 << 4
}

public interface IVolumeRepository
{
    void Add(Volume volume);
    void Update(Volume volume);
    void Remove(Volume volume);
    void Remove(IList<Volume> volumes);
    /// <summary>
    /// Points the personal rows that cascade with a volume (bookmarks, reading list items, reading activity) at the
    /// current volume of each chapter, so deleting a chapter's previous volume does not delete them
    /// </summary>
    /// <remarks>Call before saving; the chapters' Volume navigation must hold their new volume</remarks>
    Task AttachChapterReferencesToVolumesAsync(IReadOnlyCollection<Chapter> movedChapters, CancellationToken ct = default);
    /// <summary>
    /// Copies each chapter's VolumeId to the personal rows that store it without a foreign key (progress, table of
    /// contents, annotations)
    /// </summary>
    /// <remarks>Call after saving, once the chapters' new volumes have ids</remarks>
    Task SyncChapterReferenceVolumeIdsAsync(IReadOnlyCollection<int> chapterIds, CancellationToken ct = default);
    Task<IList<MangaFile>> GetFilesForVolume(int volumeId, CancellationToken ct = default);
    Task<string?> GetVolumeCoverImageAsync(int volumeId, CancellationToken ct = default);
    Task<List<int>> GetChapterIdsByVolumeIds(int seriesId, IReadOnlyList<int> volumeIds, CancellationToken ct = default);
    Task<IList<VolumeDto>> GetVolumesDtoAsync(int seriesId, int userId, VolumeIncludes includes = VolumeIncludes.Chapters, CancellationToken ct = default);
    Task<Volume?> GetVolumeByIdAsync(int volumeId, VolumeIncludes includes = VolumeIncludes.Files, CancellationToken ct = default);
    Task<VolumeDto?> GetVolumeDtoAsync(int volumeId, int userId, CancellationToken ct = default);
    Task<IEnumerable<Volume>> GetVolumesForSeriesAsync(IList<int> seriesIds, bool includeChapters = false, CancellationToken ct = default);
    Task<IEnumerable<Volume>> GetVolumes(int seriesId, CancellationToken ct = default);
    Task<IList<Volume>> GetVolumesById(IList<int> volumeIds, VolumeIncludes includes = VolumeIncludes.None, CancellationToken ct = default);
    Task<IList<Volume>> GetAllWithCoversInDifferentEncoding(EncodeFormat encodeFormat, CancellationToken ct = default);
    Task<IEnumerable<string>> GetCoverImagesForLockedVolumesAsync(CancellationToken ct = default);
    Task<long> GetFilesizeAsync(int volumeId, CancellationToken ct = default);
    Task<Dictionary<int, long>> GetFilesizesAsync(int userId, IList<int> volumeIds, CancellationToken ct = default);
}
