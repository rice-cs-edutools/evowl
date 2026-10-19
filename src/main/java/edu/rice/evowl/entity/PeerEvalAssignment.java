package edu.rice.evowl.entity;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
@ApiModel("PeerEvalAssignment")
public class PeerEvalAssignment {

  @ApiModelProperty("unique id")
  private String unique_id;

  @ApiModelProperty("assignment id")
  private Long assignment_id;

  @ApiModelProperty("net id")
  private String userId;

  @ApiModelProperty("pairs per student")
  private Integer pairs_per_student;

  @ApiModelProperty("group 1 id")
  private String group1_id;

  @ApiModelProperty("group 2 id")
  private String group2_id;

  @ApiModelProperty("grading status")
  private boolean status;
}
