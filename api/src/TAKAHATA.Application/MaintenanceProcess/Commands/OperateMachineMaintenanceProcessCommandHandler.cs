using ErrorOr;
using MapsterMapper;
using MediatR;
using TAKAHATA.Application.Common.Interface;
using TAKAHATA.Application.Common.Interface.Repositories;
using TAKAHATA.Contracts.MaintenanceProcess;
using TAKAHATA.Domain.Common.Errors;
using TAKAHATA.Domain.MasterData;

namespace TAKAHATA.Application.MaintenanceProcess.Commands
{
    public class OperateMachineMaintenanceProcessCommandHandler
        : IRequestHandler<OperateMachineMaintenanceProcessCommand, ErrorOr<MachineMaintenanceProcessResponse>>
    {
        private readonly IMapper _mapper;
        private readonly ICurrentUserService _currentUserService;
        private readonly IUserMachinePermissionRepository _userMachinePermissionRepository;
        private readonly IMachineMaintenanceProcessRepository _machineMaintenanceProcessRepository;
        private readonly IMachineRepository _machineRepository;

        public OperateMachineMaintenanceProcessCommandHandler(
            IMapper mapper,
            ICurrentUserService currentUserService,
            IUserMachinePermissionRepository userMachinePermissionRepository,
            IMachineMaintenanceProcessRepository machineMaintenanceProcessRepository,
            IMachineRepository machineRepository)
        {
            _mapper = mapper;
            _currentUserService = currentUserService;
            _userMachinePermissionRepository = userMachinePermissionRepository;
            _machineMaintenanceProcessRepository = machineMaintenanceProcessRepository;
            _machineRepository = machineRepository;
        }

        public async Task<ErrorOr<MachineMaintenanceProcessResponse>> Handle(
            OperateMachineMaintenanceProcessCommand request,
            CancellationToken cancellationToken)
        {
            var process = await _machineMaintenanceProcessRepository.GetByIdAsync(request.Id);
            if (process == null)
            {
                return Error.NotFound(
                    code: "MachineMaintenanceProcess.NotFound",
                    description: "Không tìm thấy kế hoạch bảo trì.");
            }

            var permissions = await _userMachinePermissionRepository.GetByUserIdAsync(
                _currentUserService.UserId);
            if (!permissions.Any(permission => permission.MachineId == process.MachineId))
                return Errors.Common.Forbidden;

            if (await _machineRepository.HasActiveManufacturingOperationAsync(process.MachineId))
            {
                return Errors.Machine.ManufacturingInProgress;
            }

            var now = DateTime.Now;
            switch (request.Action)
            {
                case MachineMaintenanceAction.Start when process.Status == ProcessStatus.Planned:
                    process.Status = ProcessStatus.InProgress;
                    process.StartTime = now;
                    process.EndTime = null;
                    break;

                case MachineMaintenanceAction.Resume when process.Status == ProcessStatus.Paused:
                    process.Status = ProcessStatus.InProgress;
                    process.StartTime ??= now;
                    process.EndTime = null;
                    break;

                case MachineMaintenanceAction.Pause when process.Status == ProcessStatus.InProgress:
                    process.Status = ProcessStatus.Paused;
                    break;

                case MachineMaintenanceAction.Complete
                    when process.Status is ProcessStatus.InProgress or ProcessStatus.Paused:
                    process.Status = ProcessStatus.Completed;
                    process.EndTime = now;
                    break;

                default:
                    return Error.Conflict(
                        code: "MachineMaintenanceProcess.InvalidTransition",
                        description: "Không thể thực hiện thao tác này với trạng thái bảo trì hiện tại.");
            }

            process.PerformedBy = request.PerformedBy.Trim();
            process.UpdateBy = _currentUserService.UserId;
            process.UpdateAt = now;

            var updatedProcess = await _machineMaintenanceProcessRepository.UpdateAsync(
                process,
                cancellationToken);
            if (updatedProcess == null)
                return Errors.MachineMaintenanceProcess.UpdateMachineMaintenanceProcessFalse;

            return _mapper.Map<MachineMaintenanceProcessResponse>(updatedProcess);
        }
    }
}
