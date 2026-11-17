using DocumentFormat.OpenXml.Office2010.Excel;
using ErrorOr;
using MapsterMapper;
using MediatR;
using TAKAHATA.Application.Services;
using TAKAHATA.Application.Common.Interface.Repositories;
using TAKAHATA.Contracts.Equipment;
using TAKAHATA.Contracts.IndexAndPart;
using TAKAHATA.Domain.MasterData;

namespace TAKAHATA.Application.DataLog.Queries
{
    public class MachineLogsQueryHandler : IRequestHandler<MachineLogsQuery, ErrorOr<IEnumerable<MachineLogResponse>>>
    {
        private readonly IMachineRepository _machineRepository;
        private readonly IPartProcessRepository _partProcessRepository;
        private readonly IMachineMaintenanceProcessRepository _machineMaintenanceProcessRepository;
        private readonly IMapper _mapper;

        public MachineLogsQueryHandler(
            IMachineRepository machineRepository,
            IPartProcessRepository partProcessRepository,
            IMachineMaintenanceProcessRepository machineMaintenanceProcessRepository,
            IMapper mapper)
        {
            _machineRepository = machineRepository;
            _partProcessRepository = partProcessRepository;
            _machineMaintenanceProcessRepository = machineMaintenanceProcessRepository;
            _mapper = mapper;
        }

        public async Task<ErrorOr<IEnumerable<MachineLogResponse>>> Handle(
            MachineLogsQuery request,
            CancellationToken cancellationToken)
        {
            var machines = await _machineRepository.GetAutomaticMachineAsync();

            if (machines == null || machines == null)
                return [];

            var machineList = machines.ToList();
            var inProgressProcesses = await _partProcessRepository
                .GetInProgressProcessesByMachineIdsAsync(
                    machineList.Select(machine => machine.Id).ToList(),
                    VietnamTime.Today);
            var processByMachine = inProgressProcesses
                .GroupBy(process => process.MachineId)
                .ToDictionary(group => group.Key, group => group.First());

            var hasPlantMachineIds = await _machineRepository.GetHasPlantMachine(
                machineList.Select(machine => machine.Id).ToList());
            var maintenanceProcesses = await _machineMaintenanceProcessRepository
                .GetByMachineIdsAndDateAsync(
                    machineList.Select(machine => machine.Id).ToList(),
                    VietnamTime.Today.ToDateTime(TimeOnly.MinValue));
            var maintenanceMachineIds = maintenanceProcesses
                .Where(process =>
                    process.Status != ProcessStatus.Completed &&
                    process.Status != ProcessStatus.Cancelled)
                .Select(process => process.MachineId)
                .ToHashSet();

            var response = machineList.Select(machine =>
            {
                processByMachine.TryGetValue(machine.Id, out var process);
                return new MachineLogResponse
                {
                    Id = machine.Id,
                    PartId = process?.PartId ?? 0,
                    MachineStatus = machine.MachineStatus,
                    MachineStatusChangeAt = machine.MachineStatusChangeAt,
                    Name = machine.Name,
                    Brand = machine.Brand,
                    Code = machine.Code,
                    Type = machine.Type,
                    Part = process?.Part == null
                        ? null
                        : _mapper.Map<PartResponse>(process.Part),
                    IDLE = !hasPlantMachineIds.Contains(machine.Id),
                    HasScheduledMaintenance = maintenanceMachineIds.Contains(machine.Id),
                };
            }).ToList();

            return response;
        }
    }
}
