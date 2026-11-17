using System.Net;
using System.Net.Sockets;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TAKAHATA.Application.Common.Interface.Repositories;
using TAKAHATA.Application.Common.Interface.Services;
using TAKAHATA.Application.Settings.Commands;
using TAKAHATA.Domain.Common.Constant;

namespace TAKAHATA.Api.Controllers
{
    [Authorize(Roles = Role.Admin)]
    public class SettingsController : ApiController
    {
        private readonly ISender _sender;
        private readonly IPLCSettingsService _pLCSettingsService;
        private readonly IUnitOfWorkRepository _unitOfWorkRepository;
        private readonly IMachineRepository _machineRepository;
        private readonly IPLCService _plcService;

        public SettingsController(
            ISender sender,
            IPLCSettingsService pLCSettingsService,
            IUnitOfWorkRepository unitOfWorkRepository,
            IMachineRepository machineRepository,
            IPLCService plcService)
        {
            _sender = sender;
            _pLCSettingsService = pLCSettingsService;
            _unitOfWorkRepository = unitOfWorkRepository;
            _machineRepository = machineRepository;
            _plcService = plcService;
        }

        [HttpPost("update")]
        public async Task<IActionResult> Update(UpdateSettingsCommand request)
        {
            var result = await _sender.Send(request);

            return result.Match(
                r => Ok(r),
                e => Problem(e));
        }

        [HttpPost("query")]
        public async Task<IActionResult> Query()
        {
            var response = new
            {
                IpAddress = _pLCSettingsService.GetIpAddress(),
                Port = _pLCSettingsService.GetPort(),
            };

            return Ok(response);
        }

        [HttpPost("test-connection")]
        public async Task<IActionResult> TestConnection(TestPLCConnectionRequest request)
        {
            if (!IPAddress.TryParse(request.IpAddress?.Trim(), out var ipAddress))
            {
                return BadRequest(new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Địa chỉ IP không hợp lệ."
                });
            }

            if (request.Port is < 1 or > 65535)
            {
                return BadRequest(new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Port phải nằm trong khoảng từ 1 đến 65535."
                });
            }

            using var client = new TcpClient();
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(
                HttpContext.RequestAborted);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(3));

            try
            {
                await client.ConnectAsync(ipAddress, request.Port, timeoutCts.Token);
                return Ok(new
                {
                    IsConnected = true,
                    Message = "Kết nối PLC thành công."
                });
            }
            catch (SocketException)
            {
                return Ok(new
                {
                    IsConnected = false,
                    Message = "Không thể kết nối PLC. Vui lòng kiểm tra IP, port và trạng thái PLC."
                });
            }
            catch (OperationCanceledException) when (!HttpContext.RequestAborted.IsCancellationRequested)
            {
                return Ok(new
                {
                    IsConnected = false,
                    Message = "Hết thời gian chờ kết nối PLC."
                });
            }
        }

        [HttpPost("write-machine-bits")]
        public async Task<IActionResult> WriteMachineBits(WriteMachineBitsCommand request)
        {
            var result = await _sender.Send(request);

            return result.Match(
                r => Ok(r),
                e => Problem(e));
        }

        [HttpPost("read-machine-bits")]
        public async Task<IActionResult> ReadMachineBits(ReadMachineBitsCommand request)
        {
            var result = await _sender.Send(request);

            return result.Match(
                r => Ok(r),
                e => Problem(e));
        }

        [HttpPost("clear-pending-daily-cutover")]
        public async Task<IActionResult> ClearPendingDailyCutover(
            ClearPendingDailyCutoverRequest request)
        {
            if (request.MachineId <= 0)
            {
                return BadRequest(new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Máy không hợp lệ."
                });
            }

            var reportDate = await _unitOfWorkRepository
                .ClearPendingDailyCutoverAsync(request.MachineId);
            if (!reportDate.HasValue)
            {
                return NotFound(new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "Không có yêu cầu chốt ngày đang chờ",
                    Detail = $"Máy Id={request.MachineId} hiện không có phản hồi chốt ngày đang chờ."
                });
            }

            return Ok(new
            {
                request.MachineId,
                ReportDate = reportDate.Value
            });
        }

        [HttpPost("reset-daily-cutover-state")]
        public async Task<IActionResult> ResetDailyCutoverState()
        {
            var machines = (await _machineRepository.GetAsync()).ToList();
            var configuredMachines = machines
                .Where(machine => machine.StatusBitAddress > 0)
                .ToList();

            if (configuredMachines.Count == 0)
            {
                return NotFound(new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "Không có máy được cấu hình Status Bit Address."
                });
            }

            var failures = new List<string>();
            var resetCount = 0;
            var pendingClearedCount = 0;
            var pendingMachineCount = 0;
            foreach (var machine in configuredMachines)
            {
                var result = await _plcService.WriteDailyCutoverRequestBit(
                    machine.StatusBitAddress,
                    false);
                if (!result.IsSuccess)
                {
                    failures.Add(
                        $"{machine.Code} (coil): {result.Error?.Message ?? "Không rõ lỗi"}");
                    continue;
                }

                resetCount++;
                try
                {
                    var hasClearedPending = false;
                    while (true)
                    {
                        var reportDate = await _unitOfWorkRepository
                            .ClearPendingDailyCutoverAsync(machine.Id);
                        if (!reportDate.HasValue)
                            break;

                        pendingClearedCount++;
                        if (!hasClearedPending)
                        {
                            pendingMachineCount++;
                            hasClearedPending = true;
                        }
                    }
                }
                catch (Exception ex)
                {
                    failures.Add($"{machine.Code} (pending DB): {ex.Message}");
                }
            }

            var skippedCount = machines.Count - configuredMachines.Count;
            if (failures.Count > 0)
            {
                return StatusCode(StatusCodes.Status502BadGateway, new ProblemDetails
                {
                    Status = StatusCodes.Status502BadGateway,
                    Title = "Không thể reset trạng thái chốt ngày cho một số máy.",
                    Detail =
                        $"Đã tắt coil cho {resetCount}/{configuredMachines.Count} máy; " +
                        $"đã xóa pending của {pendingMachineCount} máy " +
                        $"({pendingClearedCount} trạng thái). " +
                        $"Thất bại: {string.Join("; ", failures)}"
                });
            }

            return Ok(new
            {
                ResetCount = resetCount,
                SkippedCount = skippedCount,
                PendingMachineCount = pendingMachineCount,
                PendingClearedCount = pendingClearedCount
            });
        }

    }

    public sealed record ClearPendingDailyCutoverRequest(int MachineId);
    public sealed record TestPLCConnectionRequest(string IpAddress, int Port);
}
